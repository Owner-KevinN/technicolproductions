import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'assets', 'audio');
const compressor = 'acompressor=ratio=4:makeup=2';
const normalization = 'loudnorm=I=-14:LRA=11:TP=-1.5';
const [input, ffmpegOverride] = process.argv.slice(2);

function locateFfmpeg() {
  const candidates = [ffmpegOverride, process.env.TECHNICOL_FFMPEG, 'ffmpeg'].filter(Boolean);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const packages = [process.env.LOCALAPPDATA,path.join(os.homedir(),'AppData','Local')].filter(Boolean).map(dir=>path.join(dir,'Microsoft','WinGet','Packages')).find(dir=>fs.existsSync(dir));
    if (packages) {
      for (const item of fs.readdirSync(packages).filter(item => item.startsWith('Gyan.FFmpeg_'))) {
        const parent = path.join(packages, item);
        for (const release of fs.readdirSync(parent).filter(item => item.startsWith('ffmpeg-')).sort().reverse()) {
          candidates.push(path.join(parent, release, 'bin', 'ffmpeg.exe'));
        }
      }
    }
  }
  for (const candidate of candidates) {
    if (spawnSync(candidate, ['-version'], { windowsHide: true, stdio: 'ignore' }).status === 0) return candidate;
  }
  throw new Error('FFmpeg is unavailable. Put it on PATH or pass the full ffmpeg.exe path as the second argument.');
}

function run(ffmpeg, args) {
  return new Promise((resolve, reject) => {
    const task = spawn(ffmpeg, ['-nostdin','-hide_banner','-nostats','-loglevel','info',...args],
      {windowsHide:true,stdio:['ignore','ignore','pipe']});
    let log = '';
    task.stderr.setEncoding('utf8');
    task.stderr.on('data', chunk => { log += chunk; });
    task.on('error', reject);
    task.on('close', status => {
      if (status === 0) resolve(log);
      else reject(new Error(log.trim() || 'FFmpeg exited with status ' + status));
    });
  });
}

async function measure(ffmpeg, file, filter) {
  const log = await run(ffmpeg, ['-i',file,'-map','0:a:0','-af',filter+':print_format=json','-f','null','-']);
  const json = log.match(/\{\s*"input_i"\s*:[\s\S]*?\}/)?.[0];
  if (!json) throw new Error('No loudness measurement for ' + path.basename(file));
  const result = JSON.parse(json);
  for (const key of ['input_i','input_lra','input_tp','input_thresh','target_offset']) {
    if (!Number.isFinite(Number(result[key]))) throw new Error('Invalid ' + key + ' measurement for ' + path.basename(file));
  }
  return result;
}

async function master(ffmpeg, track, source, target) {
  const stats = await measure(ffmpeg, source, compressor+','+normalization);
  let headroom = -1.5;
  let report;
  for (let attempt=0; attempt<3; attempt++) {
    const targetFilter = normalization.replace('TP=-1.5','TP='+headroom.toFixed(2));
    const offset = attempt === 0 ? stats.target_offset : 0;
    const measured = ':measured_I='+stats.input_i+':measured_LRA='+stats.input_lra
      +':measured_TP='+stats.input_tp+':measured_thresh='+stats.input_thresh+':offset='+offset;
    await run(ffmpeg, ['-y','-i',source,'-map','0:a:0','-map_metadata','-1','-vn','-af',compressor+','+targetFilter+measured+':linear=true',
      '-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart','-metadata','title='+track.title,
      '-metadata','artist=Kevin Nicol',target]);
    const encoded = await measure(ffmpeg, target, normalization);
    report = { file:path.basename(target), loudnessLufs:Number(encoded.input_i),
      truePeakDbtp:Number(encoded.input_tp), rangeLu:Number(encoded.input_lra) };
    if (report.truePeakDbtp <= -1.5) break;
    // The codec can add peaks. Tighten the pre-encode target and verify the decoded track again.
    headroom = Math.max(-9, headroom - (report.truePeakDbtp + 1.5) - .25);
  }
  return report;
}
async function main() {
  if (!input) {
    throw new Error('Usage: node scripts/master-audio.mjs <Audio_Mastering_Temp folder> [ffmpeg executable]');
  }
  const ffmpeg = locateFfmpeg();
  const manifestFile = path.join(output, 'audio-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const { studio } = manifest;
  if (studio.length !== 12) throw new Error('Expected the twelve studio tracks in audio-manifest.json.');
  const files = new Map(fs.readdirSync(input, {withFileTypes: true})
    .filter(entry => entry.isFile()).map(entry => [entry.name.toLowerCase(), entry.name]));
  const missing = studio.filter(track => !files.has(track.source.toLowerCase())).map(track => track.source);
  if (missing.length) throw new Error('Missing input files: ' + missing.join(', '));
  for (const track of studio) {
    if (!/^assets\/audio\/[a-z0-9-]+\.m4a$/.test(track.src)) throw new Error('Unexpected output path: ' + track.src);
  }
  const temp = fs.mkdtempSync(path.join(output,'mastering-'));
  const report = [];
  try {
    const workerCount = Math.min(3,studio.length);
    let cursor = 0;
    const workers = Array.from({length:workerCount}, async () => {
      while (cursor < studio.length) {
        const index = cursor++;
        const track = studio[index];
        const source = path.join(input,files.get(track.source.toLowerCase()));
        const target = path.join(temp,path.basename(track.src));
        console.log('['+(index+1)+'/12] '+track.title);
        const result = await master(ffmpeg, track, source, target);
        report.push(result);
        console.log('  '+track.title+': '+result.loudnessLufs+' LUFS, '+result.truePeakDbtp+' dBTP after AAC');
      }
    });
    const results = await Promise.allSettled(workers);
    const failed = results.find(result=>result.status==='rejected');
    if (failed) throw failed.reason;
    for (const {file} of report) fs.renameSync(path.join(temp,file),path.join(output,file));
    manifest.mastersReady = true;
    const nextManifest = path.join(temp,'audio-manifest.json');
    fs.writeFileSync(nextManifest,JSON.stringify(manifest,null,2)+'\n');
    fs.renameSync(nextManifest,manifestFile);
    console.log('Exported '+report.length+' mastered AAC files to '+output);
    for (const item of report) {
      if (Math.abs(item.loudnessLufs + 14) > .6 || item.truePeakDbtp > -1.5) {
        console.log('Measured deviation: '+item.file+' ('+item.loudnessLufs+' LUFS, '+item.truePeakDbtp+' dBTP).');
      }
    }
  } finally {
    for (const item of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp,item));
    fs.rmdirSync(temp);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
