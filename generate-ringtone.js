const fs = require('fs');
const sampleRate = 8000;
const duration = 2; // 2 seconds loop
const numSamples = duration * sampleRate;
const buffer = Buffer.alloc(44 + numSamples);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(1, 22); // Mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate, 28);
buffer.writeUInt16LE(1, 32);
buffer.writeUInt16LE(8, 34); // 8-bit
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples, 40);

for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = (t % 2);
    // UK/NZ style ring: 0.4s on, 0.2s off, 0.4s on, 1s off
    let on = (phase < 0.4) || (phase > 0.6 && phase < 1.0);
    // Blend a couple of frequencies for a telephone sound
    const val = on ? (Math.sin(t * Math.PI * 2 * 440) + Math.sin(t * Math.PI * 2 * 480)) * 63 + 128 : 128;
    buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(val))), 44 + i);
}

fs.writeFileSync('public/ringtone.wav', buffer);
console.log('Ringtone generated.');
