const form = document.getElementById('main-form');
const recFileInput = document.getElementById('rec-file-input');
const formatSelect = document.getElementById('format');

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = (event) => {
      resolve(new Uint8Array(reader.result));
    }
    reader.readAsArrayBuffer(file);
  });
};

function convertRecToWav(array) {
  return array.map(x => (x ^ 0x6A));
};

function convertWavToMp3Bits(array) {
  var ret = [];

  function storeIfNotEmpty(buffer) {
    if (buffer.length > 0) {
      ret.push(new Uint8Array(buffer));
    }
  }

  const header = new lamejs.WavHeader.readHeader(new DataView(array.buffer));
  const waveform = new Int16Array(array.buffer, header.dataOffset);

  const encoder = new lamejs.Mp3Encoder(header.channels, header.sampleRate, 128);
  const blockSize = 1152;

  for (var i = 0; i < waveform.length; i += blockSize) {
    var block = waveform.subarray(i, i + blockSize);
    storeIfNotEmpty(encoder.encodeBuffer(block));
  }
  storeIfNotEmpty(encoder.flush());

  return ret;
};

function convertWavToWavBits(array) {
  return [array.buffer];
};

function convertWavToBits(format) {
  if (format == 'mp3') {
    return convertWavToMp3Bits;
  }
  return convertWavToWavBits;
};

function downloadBuffer(name, format, bits) {
  const blob = new File(bits, name, {type:'audio/' + format});
  const url = URL.createObjectURL(blob);

  const element = document.createElement('a');
  element.href = url;
  element.download = name;
  element.style = 'display:none';

  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);

  URL.revokeObjectURL(url);
};

form.onsubmit = function(event) {
  const file = recFileInput.files[0];
  const format = formatSelect.value;
  var name = file.name + '.' + format;

  readFile(file).then(convertRecToWav).then(convertWavToBits(format)).then((buffer) => downloadBuffer(name, format, buffer));
  event.stopPropagation();
  event.preventDefault();
}