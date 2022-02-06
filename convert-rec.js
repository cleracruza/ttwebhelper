var recFileInput;

function setState(state) {
    const submitButton = document.getElementById('submit-button');

    submitButton.disabled = (!recFileInput.files.length) || state;

    console.log('Status:', state ? state : 'Bereit!');
    submitButton.value = state ? state : 'Konvertieren!';
}

function raiseError(error) {
    var message = error;
    if (typeof(error) === 'object' && 'type' in error && typeof(error.target) === 'object' && error.target.tagName) {
        message = 'Konnte script ' + error.target.src + ' nicht laden';
    }
    console.log(error);
    window.alert(message);
    setState();
};

function assert(check, message) {
  if (!check) {
      throw Error(message);
  }
}

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
  // 65, 35, 44, 44 correspond to the "RIFF" WAV header in REC files
  assert(array[0] == 56 && array[1] == 35 && array[2] == 44 && array[3] == 44, "Datei wurde nicht als REC Datei erkannt");
  // the 0x6A is from https://github.com/entropia/tip-toi-reveng/wiki/REC-file-format
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
  assert(header.channels, "Konnte Kanalinformationen nicht lesen");
  assert(header.channels == 1, "Dateien mit " + header.channels + " Kanälen werden nicht unterstützt");

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

  setState();
};

function getDownloadName(originalName, format) {
    var name = originalName;
    if (name.substring(name.length - 4) == '.rec') {
        name = name.substring(0, name.length - 4);
    }
    name += '.' + format;
    return name;
}

function formSubmit(event) {
  const file = recFileInput.files[0];
  const format = document.getElementById('format').value;
  var name = getDownloadName(file.name, format);

  function convert() {
      setState('Konvertierung läuft ...');

      readFile(file)
          .then(convertRecToWav)
          .then(convertWavToBits(format))
          .then((buffer) => downloadBuffer(name, format, buffer))
          .catch((error) => raiseError(error));
  }

  if (format == 'mp3' && (typeof lamejs === 'undefined')) {
      const url = 'lame.all.js';

      setState('Lade ' + url + ' ...');

      var script = document.createElement('script');
      script.onload = convert;
      script.onerror = raiseError;
      script.src = url;
      document.head.appendChild(script);
  } else {
      convert();
  };

  event.stopPropagation();
  event.preventDefault();
}

function boot() {
    recFileInput = document.getElementById('rec-file-input');
    recFileInput.onchange = function(event) {
        setState();
    }
    recFileInput.oninput = onchange;
    recFileInput.onchange();

    const form = document.getElementById('main-form');
    form.onsubmit = formSubmit;
}

document.addEventListener ("DOMContentLoaded", () => {
    boot();
});
