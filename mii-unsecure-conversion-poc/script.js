      window.supportedFormats = [{
          className: 'CoreDataWii',
          sizes: [74, 76],
          preprocess: 'preprocessWiiData'
        },
        {
          className: 'CoreDataDs',
          sizes: [],
          preprocess: 'preprocessWiiData'
        },
        {
          className: 'CoreDataSwitch',
          sizes: [48, 68]
        },
        {
          className: 'CharInfoSwitch',
          sizes: [88]
        },
        {
          className: 'CoreData3ds',
          sizes: [92, 96],
          preprocess: 'convertColors'
        },
        {
          className: 'Gen3Studio',
          // the js will deobfuscate length 47 itself
          sizes: [46, 47],
          preprocess: 'useStudioStruct'
        },
      ];

			// NOTE: have lightly modified this with this new jsfiddle
      window.conversionTargets = [{
        className: 'Gen3Studio',
        sizes: [46],
        convertFunction: 'convertToStudio'
      }];


const handleConvertDetailsToggle = event => {
	if(!event.target.open // not toggled open? ignore
  		// or already revealed, we do not need to do anything
      || event.target.getAttribute('data-revealed'))
  	return;

	// we need to find the data
  // .. for now, take this from the parent's image url
  // TODO: has to be replaced since it will not always be in the url
  const hopefullyImage = event.target.parentElement.firstChild;
  const imageSrc = hopefullyImage.getAttribute('src');
  if(!imageSrc)
  	// image src should not be undefined
  	throw new Error('why is the image\'s src undefined...???');

	// get data param, if it even exists
  const imageURLParams = new URLSearchParams(new URL(imageSrc).search);
  const dataValue = imageURLParams.get('data');
  if(!dataValue)
  	throw new Error('image\'s source doesn\'t have data query parameter');

	// decode it to a uint8array whether it's hex or base64
  const textData = stripSpaces(dataValue);
  // check if it's base 16 exclusively, otherwise assume base64
  if(/^[0-9a-fA-F]+$/.test(textData))
    inputData = hexToUint8Array(textData);
  else
    inputData = base64ToUint8Array(textData);
  
  const studioURLDataElement = event.target.getElementsByClassName('studio-url-data')[0];
	const studioCodeElement = event.target.getElementsByClassName('studio-code')[0];  

	// run the function to convert the data from the image to a raw studio array
	const studioData = convertDataToStudio(inputData);
  // "studio code" = raw studio data in hex
  const studioCode = studioData.map(byteToHex).join('');
	studioCodeElement.textContent = studioCode;

  const studioURLData = encodeStudioToObfuscatedHex(studioData);
  studioURLDataElement.textContent = studioURLData;

	// mark as revealed at the end, i.e. do NOT RUN THE HANDLER ANYMORE
  event.target.setAttribute('data-revealed', '1');
}

// handle all errors and show them at the top of the page
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const errorStacktrace = document.getElementById('error-stacktrace');
window.addEventListener('error', event => {
  errorMessage.textContent = event.message;
  const error = event.error;
  // show stack trace if it has one
  errorStacktrace.textContent = error ? error.stack :
  	// otherwise just use error's line number
  	`At ${event.source}:${event.lineno}:${event.colno}`;

  // un-hide the error container
  errorContainer.style.display = '';
});

// iterate through format list, assumed to be called supportedFormats
// to find that input format and throw an error if it is not supported
const findInputFormatFromSize = size => {
	for(const format of supportedFormats) {
  	if(format.sizes.includes(size))
    	return format;
  }
  // nothing was found, throw error
  throw new Error('Input format is an unknown size of: ' + size);
}

// ensures that the format class exists and then creates the struct type
// if data is not specified, then it simply creates a blank structure of the size
const createNewInstanceOfKaitaiStructFormat = (format, data) => {
	// className in the format is assumed to be a (kaitai struct) class in window
	const structClass = window[format.className];
  // ensure that this actually exists
  if(!structClass)
    throw new Error('Cannot find format class name in window: ' + format.className);
	// find the _read prototype that kaitai constructors usually have
  if(!structClass.prototype._read)
  	throw new Error('Class does not have prototype._read and may not be generated from a Kaitai struct: ' + format.className);

	// assumed to be a KaitaiStream type passed to the constructor
	let stream;

	// if data is undefined, create a new blank stream using the first supported size
  if(data === undefined) {
  	// ensure that the format actually defines sizes
  	if(format.sizes.length < 1)
    	throw new Error(`Trying to construct a blank instance of format ${format.className} but it does not have any defined sizes and no data was passed in.`);
    // assuming that the first size in the list is sufficient
    const firstSupportedSize = format.sizes[0];
    stream = new KaitaiStream(new ArrayBuffer(firstSupportedSize));
  } else {
  	// ... otherwise, construct with data, assuming it is long enough and compatible
    // NOTE: assumes "data" is ArrayBuffer or DataView: https://github.com/kaitai-io/kaitai_struct_javascript_runtime/blob/a911d627ffeb244ce0b7873858325020d6694ba5/KaitaiStream.js#L20
  	stream = new KaitaiStream(data);

  }
  
  const struct = new structClass(stream);
  // the above function will throw an error if something goes wrong
  // notably I have seen it will if the data is not long enough for it
	return struct;
}

// for mapping objects like these kaitai structs
// where the property names match on both
const mapObjectFieldsOneToOne = (src, dest) => {
	// copy fields on the destination that the source also has
  for(const key in dest) {
  	// do not copy private fields that start with an underscore
    if(!key.startsWith('_')
    	// if the key exists on the source...
      && src[key] !== undefined)
      // ... then copy it to the destination
      dest[key] = src[key];
  }
}

// used to strip kaitai specific private fields from an object
const removeUnderscoreKeysFromObject = obj => {
  for(const key in obj) {
    if(key.startsWith('_'))
      delete obj[key];
  }
  return obj;
}

// third arugment, inupt format name, is optional
// if not provided then the size is used to auto detect
// beforeFinishFunc is another optional argument that 
// is assumed to be a function called with
// the input and output structs before returning
const convertDataToType = (data, outputFormat, inputFormatName, beforeFinishFunc) => {
	// ensure that data is an ArrayBuffer
  /*if(!(data instanceof ArrayBuffer))
  	throw new Error('data must be ArrayBuffer or compatible.');
  */

	// format comes from either findInputFormatFromSize
  // or it comes directly from supportedFormats itself
	let format;
  // if inputFormatName is NOT a valid string, so it's undefined...
  if(typeof inputFormatName !== 'string')
  	// ... auto detect based on size
    format = findInputFormatFromSize(data.length);
    // that will throw an error so we don't need to handle it ourselves
  else
  	// otherwise, inputFormatName is assumed to be className
  	format = supportedFormats.find(f => f.className === inputFormatName);
  if(!format) // find() will make it null or undefined
  	// unsupported/non-existent formatName was passed in
    throw new Error('Unknown input format name: ' + inputFormatName);

	// create a new instance of the class, with this function handling errors
  // may be overridden by the preprocessing function
	let inputStruct = createNewInstanceOfKaitaiStructFormat(format, data);

  // run this function whose role is to convert input fields
  // to be compatible with studio/switch CharInfo fields
  // TODO: not needed in all circumstances, perhaps have a discriminator the type
  if(format.preprocess) {
  	// access it from globals/window
  	const preprocessFunction = window[format.preprocess];
    // ensure that it exists and is a function
    if(typeof preprocessFunction !== 'function')
    	throw new Error(`Preprocessing function for ${format.className} is not a function: ${format.preprocess}`);
   	// pass struct into the function
    inputStruct = window[format.preprocess](inputStruct);
  }

	// assumes that outputFormat is an object and has className in it
  if(!outputFormat || outputFormat.className === undefined)
  	throw new Error('outputFormat is not a valid format object or does not have className');

	// create a new blank instance of the output format
  let outputStruct = createNewInstanceOfKaitaiStructFormat(outputFormat);
  
  // map all fields with the same names to each other
  // TODO: should use kaitai struct dedicated encoding functions instead...!!!
  mapObjectFieldsOneToOne(inputStruct, outputStruct);
  
  // call beforeFinishFunc if it exists
  if(typeof beforeFinishFunc === 'function')
  	beforeFinishFunc(inputStruct, outputStruct);

 	// we should be finished
  return outputStruct;
}

// function that uses convertDataToType but always converts to studio
// converts to a raw array and maps studio fields
// that don't match names of other structs in larsen's kaitai structs
// length of obfuscated studio data
const STUDIO_OBFUSCATED_LENGTH = 47;
const convertDataToStudio = (data, inputFormatName) => {
	// deobfsucate if the length indicates it is obfuscated
  if(data && data.length === STUDIO_OBFUSCATED_LENGTH)
  	data = studioURLObfuscationDecode(data);
  // NOTE: ASSUMES conversionTargets IS DEFINED
	const studioFormat = window.conversionTargets[0];
  const beforeFinishFunc = (input, output) => {
  	// if the studio fields are properly named according to the others then skip
		if(output.facialHairBeard !== undefined)
    	return;

		// erroneously prefixed "beard" in studio when other structs use "facialHair"
    output.beardGoatee = input.facialHairBeard;
    output.beardSize = input.facialHairSize;
    output.beardMustache = input.facialHairMustache;
    output.beardVertical = input.facialHairVertical;
  };
  // run conversion function and get kaitai struct out
	let studioStruct = convertDataToType(data, studioFormat, inputFormatName, beforeFinishFunc);

	// remove all private fields so that the object
  // represents only the struct fields in order
  studioStruct = removeUnderscoreKeysFromObject(studioStruct);
	// return an array of ints representing studio data
  return Object.values(studioStruct);
  // NOTE: could be a uint8array, however...
  // ... apparently, in order to encode to hex it has to be an array anyway
}

/* !!
 * CODE BELOW IS FROM:
 * https://mii-studio.akamaized.net/static/js/editor.pc.46056ea432a4ef3974af.js
 * search ".prototype.encode"
 * beauitifed by GPT-4
 */

// helper to map numbers to zero-padded hex
const byteToHex = num => num.toString(16).padStart(2, '0');

// encode from studio data, apply the studio url obfuscation and hex encode
const encodeStudioToObfuscatedHex = uint8Array => {
  // generate a random initial value between 0 and 255
  // NOTE: can make this 0 to disable randomization
  let initialRandomValue = Math.floor(256 * Math.random());
  let previousEncodedValue = initialRandomValue;

  // iterate over the Uint8Array and encode each byte
  for (let i = 0; i < uint8Array.length; i++) {
    let currentValue = uint8Array[i];
    // XOR the current value with the previous one and add 7, then take modulo 256
    uint8Array[i] = (7 + (currentValue ^ previousEncodedValue)) % 256;
    // update the previous value to the current encoded value
    previousEncodedValue = uint8Array[i];
  }

  // prepend the initial random value to the array and convert to a hexadecimal string
  return [initialRandomValue, ...uint8Array].map(byteToHex).join('');
}



// !! == ALL BELOW TAKEN FROM "mii2studio in js ai slop attempt 1" FIDDLE == !!

// Helper functions
const stripSpaces = str => str.replace(/\s+/g, '');
const hexToUint8Array = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const base64ToUint8Array = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

// Function to detect input type based on size
/*
const detectInputType = (data) => {
  for (const format of supportedFormats) {
    if (format.sizes.includes(data.length)) {
      return format;
    }
  }
  throw new Error('Unsupported data size.');
};
*/

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

/*
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
*/
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

/*
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
*/

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