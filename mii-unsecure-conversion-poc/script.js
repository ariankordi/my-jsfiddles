// NOTE: 3DS/Wii U compatible data is referred to officially in the Switch nn::mii library as "Ver3": "nn::mii::Ver3StoreData", functions and tables using "ToVer3" and "FromVer3", mii_Ver3Common.cpp, mii_Ver3StoreDataTable.cpp, etc.
// Switch data is not commonly referred to as Ver4, however, in Pikmin Bloom's global-metadata.dat, there are references to "CharInfoConverter.dll" and "CoreDataConverter.dll", and there are many strings referring to Ver3, many directly from nn::mii, even a string that looks like a const or macro in the file: "NN_MII_CHAR_INFO_SIZE". And finally, there is one string in there reading "FromVer4CoreData".
// Now, even though Pikmin Bloom is in Unity and not developed by Nintendo, there's still one other reference to the name. The Coral API endpoint "me.json" has a child in a "mii" object called "storeData", containing another child named simply "3" with 96-byte long Base64 data. However, there is another element called "coreData" containing a child named "4" with 48-byte long Base64 data. SO, there you go: ver3 storedata, and ver4 coredata.
// that's why for simplicity, 3DS/Wii U format will be reffered to as "Ver3" and Switch/Studio as "Ver4". idk what wii is but it will be 1

// NOTE: "to" functions need to be defined in conersionMethods
			window.supportedFormats = [{
          className: 'CoreDataWii',
          sizes: [74, 76],
          toVer3Function: 'convertWiiFieldsToVer3',
          toVer4Function: 'convertVer3FieldsToVer4'
        },
        {
          className: 'CoreDataSwitch',
          sizes: [48, 68]
        },
        {
          className: 'CharInfoSwitch',
          sizes: [88],
          version: 4
        },
        {
          className: 'CoreData3ds',
          sizes: [92, 96],
          version: 3,
          toVer4Function: 'convertVer3FieldsToVer4',
        },
        {
          className: 'Gen3Studio',
          // the js will deobfuscate length 47 itself
          sizes: [46, 47],
          version: 4,
          // TODO: replace with a function that
          // downgrades the fields AND removes underscores
          toVer3Function: 'removeUnderscoreKeysFromObject',
          // needs to be run every time before using
          toVer4Function: 'removeUnderscoreKeysFromObject'
        },
      ];

// conversion methods for supportedFormats are defined here instead of window now
let conversionMethods = {};
// convert fields from ver3 and below to be compatible with switch/studio
// the only fields that need to be made compatible, however,
// , are the colors to convert them to the CommonColor type
conversionMethods.convertVer3FieldsToVer4 = data => {
  // cannot just set these directly, have to set the properties
  // kaitai structs use defineProperty to make these fetch from bitshifts

	// NOTE: while there is a table to map ver3 colors to the CommonColor type...
  // ... mii2studio took a shortcut, which is also what is being done here
  // due to the fact that in the common color tables, there is a contiguous
  // section of ver3-compatible colors so this "bumps them" to that section
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
  // NOTE: you cannot do the same vice-versa to convert ver4 colors back
  // ver4 also has new glass types, and...
  // ... faceline/skin color is not mapped (ver3 ones work on ver4)
  return data;
}


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
  
  const ver3StoreDataElement = event.target.getElementsByClassName('ver3storedata')[0];
  const inputFormat = findInputFormatFromSize(inputData.length);
  // TODO: REMOVE THIS WHEN I STOP USING THIS STRUCT
 	//if(inputFormat.className == 'CoreData3ds') {
  	ver3StoreDataElement.parentElement.style.display = ''
  	const dataStruct = createNewInstanceOfKaitaiStructFormat(inputFormat, inputData);
    const newStoreDataLolMaybe = encode3DSStoreDataFromStructCopiedFromKazukiMiiEncode(dataStruct)
  	ver3StoreDataElement.textContent = [...newStoreDataLolMaybe].map(byteToHex).join('')
  //}
  
  const studioURLDataElement = event.target.getElementsByClassName('studio-url-data')[0];
	const studioCodeElement = event.target.getElementsByClassName('studio-code')[0];  

	// run the function to convert the data from the image to raw studio data
	const studioData = convertDataToStudio(inputData);
  // "studio code" = raw studio data in hex
  // NOTE: three dots are only required if it is a uint8array which
  // it is only one if the input data is studio data directly
  const studioCode = [...studioData].map(byteToHex).join('');
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
const errorAt = document.getElementById('error-at');
window.addEventListener('error', event => {
  errorMessage.textContent = event.message;
  // show stack trace if it has one
  if(event.error) {
    errorStacktrace.textContent = event.error.stack;
    errorStacktrace.style.display = '';
  } else {
    // otherwise just use error's line number
  	errorAt.textContent = (event.source + ':' + event.lineno + ':' + event.colno);
    errorAt.style.display = '';
  }

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
      && src[key] !== undefined) {
      	// ... then copy it to the destination
      	// actually if it is a bool it needs to be an int
        if(typeof src[key] === 'boolean')
        	dest[key] = Number(src[key]);
        else
	        dest[key] = src[key];
      }
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
conversionMethods.removeUnderscoreKeysFromObject = removeUnderscoreKeysFromObject;


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

	// NOTE: SPECIAL CASE: DEOBFUSCATE STUDIO DATA
  if(data && data.length === STUDIO_OBFUSCATED_LENGTH)
  	data = studioURLObfuscationDecode(data);
  // this is already done in convert to studio's dedicated function
  // and could be avoided if there were a pre-process function
  // actually NOTE: the dedicated studio and 3ds encode functions could be
  // dropped entirely if the definitions had an encode function defined


	// create a new instance of the class, with this function handling errors
  // may be overridden by the preprocessing function
	let inputStruct = createNewInstanceOfKaitaiStructFormat(format, data);

	// assumes that outputFormat is an object and has className in it
  if(!outputFormat || outputFormat.className === undefined)
  	throw new Error('outputFormat is not a valid format object or does not have className');

	// evaluate what functions should be run to convert the input data
  if(typeof outputFormat.version !== 'number')
  	throw new Error('All output format definitions need a "version" field that\'s a number.');

/*
	const ver3ConvertFunc = format.toVer3Function;
  const ver4ConvertFunc = format.toVer4Function;
*/
  // checks if the property is defined or not
  if(format.toVer3Function !== undefined)
  	// TODO: DOES NOT CHECK WHETHER THE FUNCTION ITSELF IS UNDEFINED
  	inputStruct = conversionMethods[format.toVer3Function](inputStruct);

  // only run the to version 4 conversion, if this is actually version 4
  if(outputFormat.version >= 4 && format.toVer4Function !== undefined)
  	// TODO: DOES NOT CHECK WHETHER THE FUNCTION ITSELF IS UNDEFINED
  	inputStruct = conversionMethods[format.toVer4Function](inputStruct);

  // run this function whose role is to convert input fields
  // to be compatible with studio/switch CharInfo fields
  // TODO: not needed in all circumstances, perhaps have a discriminator the type
/*  if(format.preprocess) {
  	// access it from globals/window
  	const preprocessFunction = window[format.preprocess];
    // ensure that it exists and is a function
    if(typeof preprocessFunction !== 'function')
    	throw new Error(`Preprocessing function for ${format.className} is not a function: ${format.preprocess}`);
   	// pass struct into the function
    inputStruct = window[format.preprocess](inputStruct);
  }
*/
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
// assuming that the studio format name is always "Gen3Studio"
const studioFormat = supportedFormats.find(f => f.className === 'Gen3Studio');
const convertDataToStudio = (data, inputFormatName) => {
	// deobfsucate if the length indicates it is obfuscated
  if(data && data.length === STUDIO_OBFUSCATED_LENGTH)
  	data = studioURLObfuscationDecode(data);
	// if this is studio data directly then no conversion is required
	if(findInputFormatFromSize(data.length) === studioFormat)
  	return data;

	// should NOT continue here if the data is studio 46 or 47 bytes long
  const beforeFinishFunc = (input, output) => {
  	// if the studio fields are properly named according to the others then skip
		if(output.facialHairBeard !== undefined
    	// ... or, if this is somehow already the same studio struct?!
      || input.beardGoatee !== undefined)
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
	// array of ints representing studio data
  const studioData = Object.values(studioStruct);
	// return as a uint8array for consistency
	return studioData;//new Uint8Array(studioData);
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

// TODO: TODO: CHECK IF YOU CAN PUT THE TWO TABLES INTO ONE
// TODO: ALSO CHECK IF YOU CAN MAKE THIS SHORTER
// converts Wii properties to ver3 compatible properties
conversionMethods.convertWiiFieldsToVer3 = data => {
  // wii data does not support y scale so these are constant
  data.eyeStretch = 3;
  data.mouthStretch = 3;
  data.eyebrowStretch = 3;

  // tables to map "FaceLineAndMake" field in RFLCharData...
  // ... to FaceMake and FaceLine properties for 3DS-compatible data
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
  // NOTE: tables taken directly from mii2studio.py
  // ... but they can be taken from FFL too

	// TODO: CAN YOU REMOVE hasOwnProperty HERE???
  if(makeup.hasOwnProperty(data.facialFeature))
    data.faceMakeup = makeup[data.facialFeature];
  if(wrinkles.hasOwnProperty(data.facialFeature))
    data.faceWrinkles = wrinkles[data.facialFeature];

  return data;
}

// courtesy of gpt4o
const encode3DSStoreDataFromStructCopiedFromKazukiMiiEncode = kaitaiStruct => {
  let buf = new Uint8Array(0x48 + 20 + 2 + 2);  // 0x48 bytes + 20 bytes for creatorName + 2 bytes padding + 2 bytes checksum

  // Encoding the fields into the buffer, mirroring the Kaitai struct deserialization
  buf[0x00] = kaitaiStruct.unknown1;
  buf[0x01] = (kaitaiStruct.characterSet & 0x03) | 
    ((kaitaiStruct.regionLock & 0x03) << 2) | 
    ((kaitaiStruct.profanityFlag ? 1 : 0) << 4) | 
    ((kaitaiStruct.copying ? 1 : 0) << 5) | 
    ((kaitaiStruct.unknown2 & 0x03) << 6);
  buf[0x02] = (kaitaiStruct.miiPositionSlotIndex & 0x0F) | 
    ((kaitaiStruct.miiPositionPageIndex & 0x0F) << 4);
  buf[0x03] = (kaitaiStruct.version & 0x0F) | 
    ((kaitaiStruct.unknown3 & 0x0F) << 4);

  for (let i = 0; i < 8; i++) {
    buf[0x04 + i] = kaitaiStruct.systemId[i];
  }

  for (let i = 0; i < 4; i++) {
    buf[0x0C + i] = kaitaiStruct.avatarId[i];
  }

  for (let i = 0; i < 6; i++) {
    buf[0x10 + i] = kaitaiStruct.clientId[i];
  }

  // Padding
  buf[0x16] = kaitaiStruct.padding & 0xFF;
  buf[0x17] = (kaitaiStruct.padding >> 8) & 0xFF;

  // Data1 field
  buf[0x18] = (kaitaiStruct.gender & 0x01) |
    ((kaitaiStruct.birthMonth & 0x0F) << 1) |
    ((kaitaiStruct.birthDay & 0x1F) << 5);
  buf[0x19] = ((kaitaiStruct.birthDay >> 3) & 0x03) |
    ((kaitaiStruct.favoriteColor & 0x0F) << 2) |
    ((kaitaiStruct.favorite ? 1 : 0) << 6);

  // Mii name (UTF-16LE encoding)
  let miiNameBytes = new TextEncoder('utf-16le').encode(kaitaiStruct.miiName.padEnd(10, '\0'));
  buf.set(miiNameBytes, 0x1A);

  buf[0x2E] = kaitaiStruct.bodyHeight;
  buf[0x2F] = kaitaiStruct.bodyWeight;

	buf[0x30] = ((kaitaiStruct.faceColor & 0x07) << 5) | // Skin Color occupies bits 5-7 (3 bits)
            ((kaitaiStruct.faceType & 0x0F) << 1) |  // Face Shape occupies bits 1-4 (4 bits)
            (kaitaiStruct.mingle ? 1 : 0);           // Mingle occupies bit 0 (1 bit)

  buf[0x31] = (kaitaiStruct.faceWrinkles & 0x0F) | 
    ((kaitaiStruct.faceMakeup & 0x0F) << 4);

  buf[0x32] = kaitaiStruct.hairType;
  buf[0x33] = (kaitaiStruct.hairColor & 0x07) |
    ((kaitaiStruct.hairFlip ? 1 : 0) << 3) |
    ((kaitaiStruct.unknown5 & 0x0F) << 4);

  // Eye details (U4LE)
  let eyeDetails = kaitaiStruct.eyeType |
      (kaitaiStruct.eyeColor << 6) |
      (kaitaiStruct.eyeSize << 9) |
      (kaitaiStruct.eyeStretch << 13) |
      (kaitaiStruct.eyeRotation << 16) |
      (kaitaiStruct.eyeHorizontal << 21) |
      (kaitaiStruct.eyeVertical << 25);
  buf[0x34] = eyeDetails & 0xFF;
  buf[0x35] = (eyeDetails >> 8) & 0xFF;
  buf[0x36] = (eyeDetails >> 16) & 0xFF;
  buf[0x37] = (eyeDetails >> 24) & 0xFF;

  // Eyebrow details (U4LE)
  let eyebrowDetails = kaitaiStruct.eyebrowType |
      (kaitaiStruct.eyebrowColor << 5) |
      (kaitaiStruct.eyebrowSize << 8) |
      (kaitaiStruct.eyebrowStretch << 12) |
      (kaitaiStruct.eyebrowRotation << 16) |
      (kaitaiStruct.eyebrowHorizontal << 21) |
      (kaitaiStruct.eyebrowVertical << 25);
  buf[0x38] = eyebrowDetails & 0xFF;
  buf[0x39] = (eyebrowDetails >> 8) & 0xFF;
  buf[0x3A] = (eyebrowDetails >> 16) & 0xFF;
  buf[0x3B] = (eyebrowDetails >> 24) & 0xFF;

  // Nose details (U2LE)
  let noseDetails = kaitaiStruct.noseType |
      (kaitaiStruct.noseSize << 5) |
      (kaitaiStruct.noseVertical << 9);
  buf[0x3C] = noseDetails & 0xFF;
  buf[0x3D] = (noseDetails >> 8) & 0xFF;

  // Mouth details (U2LE)
  let mouthDetails = kaitaiStruct.mouthType |
      (kaitaiStruct.mouthColor << 6) |
      (kaitaiStruct.mouthSize << 9) |
      (kaitaiStruct.mouthStretch << 13);
  buf[0x3E] = mouthDetails & 0xFF;
  buf[0x3F] = (mouthDetails >> 8) & 0xFF;

  // Mouth2 details (U2LE)
  let mouth2Details = kaitaiStruct.mouthVertical |
      (kaitaiStruct.facialHairMustache << 5);
  buf[0x40] = mouth2Details & 0xFF;
  buf[0x41] = (mouth2Details >> 8) & 0xFF;

  // Beard details (U2LE)
  let beardDetails = kaitaiStruct.facialHairBeard |
      (kaitaiStruct.facialHairColor << 3) |
      (kaitaiStruct.facialHairSize << 6) |
      (kaitaiStruct.facialHairVertical << 10);
  buf[0x42] = beardDetails & 0xFF;
  buf[0x43] = (beardDetails >> 8) & 0xFF;

  // Glasses details (U2LE)
  let glassesDetails = kaitaiStruct.glassesType |
      (kaitaiStruct.glassesColor << 4) |
      (kaitaiStruct.glassesSize << 7) |
      (kaitaiStruct.glassesVertical << 11);
  buf[0x44] = glassesDetails & 0xFF;
  buf[0x45] = (glassesDetails >> 8) & 0xFF;

  // Mole details (U2LE)
  let moleDetails = kaitaiStruct.moleEnable |
      (kaitaiStruct.moleSize << 1) |
      (kaitaiStruct.moleHorizontal << 5) |
      (kaitaiStruct.moleVertical << 10);
  buf[0x46] = moleDetails & 0xFF;
  buf[0x47] = (moleDetails >> 8) & 0xFF;

  // Creator name (UTF-16LE encoding)
  let creatorNameBytes = new TextEncoder('utf-16le').encode(kaitaiStruct.creatorName.padEnd(10, '\0'));
  buf.set(creatorNameBytes, 0x48);

  // Padding and checksum
  buf[0x5C] = kaitaiStruct.padding2 & 0xFF;
  buf[0x5D] = (kaitaiStruct.padding2 >> 8) & 0xFF;
  buf[0x5E] = kaitaiStruct.checksum & 0xFF;
  buf[0x5F] = (kaitaiStruct.checksum >> 8) & 0xFF;

  return buf;
}


// deobfuscate the obfuscated studio url format
// from, and to, a Uint8Array (so requires converting from/to hex)
const studioURLObfuscationDecode = data => {
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
