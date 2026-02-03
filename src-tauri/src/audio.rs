use std::io::Cursor;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use hound::{SampleFormat as WavSampleFormat, WavSpec, WavWriter};

pub struct AudioRecorder {
    samples: Arc<Mutex<Vec<i16>>>,
    recording: Arc<AtomicBool>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
    sample_rate: Mutex<u32>,
}

impl Default for AudioRecorder {
    fn default() -> Self {
        Self {
            samples: Arc::new(Mutex::new(Vec::new())),
            recording: Arc::new(AtomicBool::new(false)),
            thread_handle: Mutex::new(None),
            sample_rate: Mutex::new(16000),
        }
    }
}

impl AudioRecorder {
    pub fn start(&self) -> Result<(), String> {
        if self.recording.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.samples.lock().unwrap().clear();
        self.recording.store(true, Ordering::SeqCst);

        let samples = Arc::clone(&self.samples);
        let recording = Arc::clone(&self.recording);
        let sample_rate_holder = Arc::new(Mutex::new(16000u32));
        let sample_rate_for_thread = Arc::clone(&sample_rate_holder);

        let handle = thread::spawn(move || {
            if let Err(e) = run_audio_capture(samples, recording, sample_rate_for_thread) {
                eprintln!("Audio capture error: {e}");
            }
        });

        *self.thread_handle.lock().unwrap() = Some(handle);

        // Give the thread a moment to start and set the sample rate
        thread::sleep(std::time::Duration::from_millis(100));

        if let Ok(rate) = sample_rate_holder.lock() {
            *self.sample_rate.lock().unwrap() = *rate;
        }

        Ok(())
    }

    pub fn stop(&self) -> Result<Vec<u8>, String> {
        self.recording.store(false, Ordering::SeqCst);

        // Wait for the audio thread to finish
        if let Some(handle) = self.thread_handle.lock().unwrap().take() {
            let _ = handle.join();
        }

        let samples = self.samples.lock().unwrap();
        if samples.is_empty() {
            return Err("No audio captured".to_string());
        }

        let sample_rate = *self.sample_rate.lock().unwrap();

        let spec = WavSpec {
            channels: 1,
            sample_rate: sample_rate.max(1),
            bits_per_sample: 16,
            sample_format: WavSampleFormat::Int,
        };

        let mut wav_buffer = Vec::new();
        {
            let mut writer =
                WavWriter::new(Cursor::new(&mut wav_buffer), spec).map_err(|e| e.to_string())?;
            for &sample in samples.iter() {
                writer.write_sample(sample).map_err(|e| e.to_string())?;
            }
            writer.finalize().map_err(|e| e.to_string())?;
        }

        Ok(wav_buffer)
    }
}

fn run_audio_capture(
    samples: Arc<Mutex<Vec<i16>>>,
    recording: Arc<AtomicBool>,
    sample_rate_holder: Arc<Mutex<u32>>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;

    let supported_config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get input config: {e}"))?;

    let sample_format = supported_config.sample_format();
    let config: cpal::StreamConfig = supported_config.into();

    *sample_rate_holder.lock().unwrap() = config.sample_rate.0;
    let channels = config.channels as usize;

    let samples_clone = Arc::clone(&samples);
    let recording_clone = Arc::clone(&recording);

    let err_fn = |err| eprintln!("Audio stream error: {err}");

    let stream = match sample_format {
        SampleFormat::I16 => device
            .build_input_stream(
                &config,
                move |data: &[i16], _| {
                    if recording_clone.load(Ordering::SeqCst) {
                        push_mono_i16(&samples_clone, data, channels, |v| v);
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {e}"))?,
        SampleFormat::U16 => {
            let samples_clone = Arc::clone(&samples);
            let recording_clone = Arc::clone(&recording);
            device
                .build_input_stream(
                    &config,
                    move |data: &[u16], _| {
                        if recording_clone.load(Ordering::SeqCst) {
                            push_mono_i16(&samples_clone, data, channels, |v| {
                                (v as i32 - 32768) as i16
                            });
                        }
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Failed to build input stream: {e}"))?
        }
        SampleFormat::F32 => {
            let samples_clone = Arc::clone(&samples);
            let recording_clone = Arc::clone(&recording);
            device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _| {
                        if recording_clone.load(Ordering::SeqCst) {
                            push_mono_i16(&samples_clone, data, channels, |v| {
                                let clamped = v.clamp(-1.0, 1.0);
                                (clamped * i16::MAX as f32) as i16
                            });
                        }
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Failed to build input stream: {e}"))?
        }
        _ => return Err("Unsupported sample format".to_string()),
    };

    stream
        .play()
        .map_err(|e| format!("Failed to start input stream: {e}"))?;

    // Keep the stream alive while recording
    while recording.load(Ordering::SeqCst) {
        thread::sleep(std::time::Duration::from_millis(10));
    }

    Ok(())
}

fn push_mono_i16<T, F>(samples: &Arc<Mutex<Vec<i16>>>, data: &[T], channels: usize, convert: F)
where
    T: Copy,
    F: Fn(T) -> i16,
{
    if channels == 0 {
        return;
    }

    if let Ok(mut buffer) = samples.lock() {
        for frame in data.chunks(channels) {
            let mut acc = 0i32;
            let mut count = 0i32;
            for &sample in frame {
                acc += convert(sample) as i32;
                count += 1;
            }
            if count > 0 {
                buffer.push((acc / count) as i16);
            }
        }
    }
}
