// Helper functions
const stripSpaces = str => str.replace(/\s+/g, '');
const hexToUint8Array = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const base64ToUint8Array = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

// Function to generate a random pastel color
const randomPastelColor = () => {
  const hue = Math.random() * 360;
  const lightness = window.matchMedia('(prefers-color-scheme: dark)').matches ? '30%' : '80%';
  return `hsl(${hue}, 100%, ${lightness})`;
};

// Function to detect input type based on size
const detectInputType = (data) => {
  for (const format of supportedFormats) {
    if (format.sizes.includes(data.length)) {
      return format;
    }
  }
  throw new Error('Unsupported data size.');
};

// Function to convert colors to Switch/Studio values
function convertColors(data) {
  // cannot just set these directly, have to set the properties
  Object.defineProperty(data, 'facialHairColor', {
    value: data.facialHairColor === 0 ? 8 : data.facialHairColor
  });
  Object.defineProperty(data, 'eyeColor', {
    value: data.eyeColor + 8
  });
  Object.defineProperty(data, 'eyebrowColor', {
    value: data.eyebrowColor === 0 ? 8 : data.eyebrowColor
  });
  Object.defineProperty(data, 'glassesColor', {
    value: data.glassesColor === 0 ? 8 : (data.glassesColor < 6 ? data.glassesColor + 13 : 0)
  });
  Object.defineProperty(data, 'hairColor', {
    value: data.hairColor === 0 ? 8 : data.hairColor
  });
  Object.defineProperty(data, 'mouthColor', {
    value: data.mouthColor < 4 ? data.mouthColor + 19 : 0
  });
  return data;
}

// Function to preprocess Wii data derived from the Python code
function preprocessWiiData(origData) {
  // Set static values for eyeStretch, mouthStretch, and eyebrowStretch
  origData.eyeStretch = 3;
  origData.mouthStretch = 3;
  origData.eyebrowStretch = 3;

  // Map faceMakeup and faceWrinkles from facialFeature
  const makeup = {
    1: 1,
    2: 6,
    3: 9,
    9: 10
  };

  const wrinkles = {
    4: 5,
    5: 2,
    6: 3,
    7: 7,
    8: 8,
    10: 9,
    11: 11
  };

  if (makeup.hasOwnProperty(origData.facialFeature)) {
    origData.faceMakeup = makeup[origData.facialFeature];
  }

  if (wrinkles.hasOwnProperty(origData.facialFeature)) {
    origData.faceWrinkles = wrinkles[origData.facialFeature];
  }

  origData = convertColors(origData);

  return origData;
}


// Function to map fields from one struct to another
function mapStructFields(src, dest) {
  for (const key in dest) {
    if (key.startsWith('_')) {
      delete dest[key];
      continue;
    }
    if (src[key] !== undefined) {
      dest[key] = src[key];
    }
  }
  return dest;
}

// Function to decode the obfuscated studio URL data
function studioURLObfuscationDecode(data) {
    const decodedData = new Uint8Array(data);
    const random = decodedData[0];
    let previous = random;

    for (let i = 1; i < 48; i++) {
        const encodedByte = decodedData[i];
        const original = (encodedByte - 7 + 256) % 256;
        decodedData[i - 1] = original ^ previous;
        previous = encodedByte;
    }

    return decodedData.slice(0, 46); // Return the first 46 bytes
}

function useStudioStruct(origData) {
  for (const key in origData) {
    if (key.startsWith('_')) {
      delete origData[key];
    }
  }
	return origData;
}

// Function to convert to Studio format
function convertToStudio(origData) {
  const studioData = new Gen3Studio(new KaitaiStream(new ArrayBuffer(46)));
  const mappedData = mapStructFields(origData, studioData);
  mappedData.beardGoatee = origData.facialHairBeard;
  mappedData.beardSize = origData.facialHairSize;
  mappedData.beardMustache = origData.facialHairMustache;
  mappedData.beardVertical = origData.facialHairVertical;
  return mappedData;
}

// Function to map data to Studio format string
function miiMap2Studio(map) {
  const len = map.length;
  let randomCopy = 0;
  for (let i = 0; i < len; i++) {
    map[i] = (7 + (map[i] ^ randomCopy)) % 256;
    randomCopy = map[i];
  }
  return [0].concat(map).map(i => i.toString(16).padStart(2, '0')).join('');
}

// Form submit handler
function handleSubmit(event) {
  if (event !== undefined) event.preventDefault();
  try {
    const fileInput = document.getElementById('dataFile');
    const textInput = document.getElementById('dataText');
    const typeSelect = document.getElementById('dataType');
    let inputData;

    if (fileInput.files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        inputData = new Uint8Array(reader.result);
        processData(inputData, typeSelect.value);
        fileInput.style.border = '2px solid green';
        textInput.style.border = '';
      };
      reader.readAsArrayBuffer(fileInput.files[0]);
    } else {
      const textData = stripSpaces(textInput.value);
      if (/^[0-9a-fA-F]+$/.test(textData)) {
        inputData = hexToUint8Array(textData);
      } else {
        inputData = base64ToUint8Array(textData);
      }
      processData(inputData, typeSelect.value);
      fileInput.style.border = '';
      textInput.style.border = '2px solid green';
    }
  } catch (error) {
    displayError(error.message);
  }
}

// Function to process input data
function processData(data, selectedType) {
  try {
    let format;
    if (selectedType === 'auto') {
      format = detectInputType(data);
    } else {
      format = supportedFormats.find(f => f.className === selectedType);
    }
    if (!format) {
      throw new Error('Unsupported data type selected.');
    }
    const KaitaiStructClass = window[format.className];
    if (!KaitaiStructClass) {
      throw new Error(`Kaitai struct class ${format.className} not found.`);
    }

		// Special case for Studio data that's 47 bytes/obfuscated.
    if (format.className === 'Gen3Studio' && data.length === 47) {
      data = studioURLObfuscationDecode(data);
    }

    let origData = new KaitaiStructClass(new KaitaiStream(data));
    if (format.preprocess) {
      origData = window[format.preprocess](origData);
    }
    const studioData = window[conversionTargets[0].convertFunction](origData);
    const studioURLCode = miiMap2Studio(Object.values(studioData));
    displayResult(origData, studioURLCode, studioData);
  } catch (error) {
    displayError(error.message);
  }
}

// Function to display the result
function displayResult(origData, studioURLCode, studioData) {
  const resultList = document.getElementById('resultList');
  const resultTemplate = document.getElementById('resultTemplate');
  const resultNode = document.importNode(resultTemplate.content, true);
  resultNode.querySelector('.timestamp').textContent = new Date().toLocaleString();
  resultNode.querySelector('.data-name').textContent = origData.miiName || '';
  resultNode.querySelector('.studio-url-data').textContent = studioURLCode;
  resultNode.querySelector('.studio-code').textContent = [...new Uint8Array(Object.values(studioData))].map(x => x.toString(16).padStart(2, '0')).join('');
  resultNode.querySelector('.data-image').src += studioURLCode;
  resultNode.querySelector('li').style.backgroundColor = randomPastelColor();
  resultList.insertBefore(resultNode, resultList.firstChild);
}

// Function to display an error
function displayError(message) {
  const resultList = document.getElementById('resultList');
  const errorTemplate = document.getElementById('errorTemplate');
  const errorNode = document.importNode(errorTemplate.content, true);
  errorNode.querySelector('.timestamp').textContent = new Date().toLocaleString();
  errorNode.querySelector('.error-message').textContent = message;
  resultList.insertBefore(errorNode, resultList.firstChild);
}

// Function to handle image load error
function displayImageError(imgElement) {
  imgElement.alt = 'The image failed to load.';
  imgElement.nextElementSibling.classList.remove('hidden');
}

// Function to highlight border of the last used input method
function highlightBorder(inputType) {
  const fileInput = document.getElementById('dataFile');
  const textInput = document.getElementById('dataText');
  if (inputType === 'file') {
    fileInput.style.border = '2px solid green';
    textInput.style.border = '';
  } else {
    fileInput.style.border = '';
    textInput.style.border = '2px solid green';
  }
}
