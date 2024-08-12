// fill results with dummies for now

const defaultResults = [
	{name: 'Jasmine', data: 'AwBgMIJUICvpzY4vnWYVrXy7ikd01AAAWR1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAML0'},
  {name: 'Mii Studio Mii', data: 'f5fa013d45545e6048516667767883959a9da4acacb3bbc1d8e6eceef6fd8d98a0a7b2b0bbafb5b2c6c9d0c7ced5d8'},
  {name: 'Bro Mole High', data: 'AwAAQN9uZ0eqxkc022v7dby8sBv4ogAAAARiAHIAbwAAAAAAAAAAAAAAAAAAAEBALJI5AgKJRBZmNEYQzRINSE8A4igiQolZAAAAAAAAAAAAAAAAAAAAAAAAAAAAACpP'},
  {name: 'Mii Studio Mii', data: '000b10575a727d808992a0aaa7a8b3bcc5d4dadae3e8f0f7eaf5fefd060d3b828d93a6b7bcb6b9bbbbbfc4d5dadede'},
  {name: 'Mii Studio Mii', data: '0050575e64525d61848d8a93c4cad5dfe0f3fa0212191a220f0f131f838af8f1f7fef9f5fbeff4f4000b120910171a'}
];

const resultsList = document.getElementById('results');
const resultTemplate = document.getElementById('result-template');

const addToResultList = (data, name) => {
	// clone the template so that we can put the result text in it
  const resultTemplateClone = resultTemplate.cloneNode(true);
	// remove the id so that it does not conflict
	resultTemplateClone.removeAttribute('id');
  // this SHOULD be the first span in summary
  // NOTE: this line is most likely to error out
  const nameInResult = resultTemplateClone.getElementsByTagName('summary')[0].firstElementChild;
  nameInResult.textContent = name;
  const imageInResult = resultTemplateClone.getElementsByTagName('img')[0];
  const imageInResultNewURL = imageInResult.getAttribute('no-src') + data;
  imageInResult.setAttribute('src', imageInResultNewURL);
  
  // finally, reveal and prepend it
  resultTemplateClone.style.display = '';
  resultsList.prepend(resultTemplateClone);
};

defaultResults.forEach(result => {
	addToResultList(result.data, result.name);
});

const addToResultListFromFormSubmit = event => {
	event.preventDefault();
  
  // find form elements
  const formName = document.getElementById('form-name');
  const formData = document.getElementById('form-data');

	let name, data;

	name = formName.value;
  if(!name) name = 'mii with no name';
  data = formData.value;
  addToResultList(data, name);
};


// NOTE: 3DS/Wii U compatible data is referred to officially in the Switch nn::mii library as "Ver3": "nn::mii::Ver3StoreData", functions and tables using "ToVer3" and "FromVer3", mii_Ver3Common.cpp, mii_Ver3StoreDataTable.cpp, etc.
// Switch data is not commonly referred to as Ver4, however, in Pikmin Bloom's global-metadata.dat, there are many strings referring to Ver3, many being symbols directly from nn::mii, even a string that looks like a const or macro in the file: "NN_MII_CHAR_INFO_SIZE". And finally, there is a string in there reading "FromVer4CoreData".
// Now, even though Pikmin Bloom is in Unity and not developed by Nintendo, there's still one other reference to the name. The Coral API endpoint "me.json" has a child in a "mii" object called "storeData", containing another child named simply "3" with 96-byte long Base64 data. However, there is another element called "coreData" containing a child named "4" with 48-byte long Base64 data. SO, there you go: Ver3StoreData, and Ver4CoreData.
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
          sizes: [48, 68],
          version: 4,
          toVer3Function: 'convertVer4FieldsToVer3'
        },
        {
          className: 'CharInfoSwitch',
          sizes: [88],
          version: 4,
          toVer3Function: 'convertVer4FieldsToVer3'
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
          toVer3Function: 'convertStudioToVer3',
          // needs to be run every time before using
          toVer4Function: 'removeUnderscoreKeysFromObject',
          preConvertFromFunction: '',
          postConvertToFunction: '',
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
};

// converting fields from ver4 to ver3, like vice versa,
// involves reassigning colors, from CommonColor to the respective ver3 types
// one of the differences is that this is also reassigning glass type as ver4 has more
// NOTE: this is currently making use of tables from MiiPort:
// https://github.com/Genwald/MiiPort/blob/4ee38bbb8aa68a2365e9c48d59d7709f760f9b5d/include/convert_mii.h#L18
conversionMethods.convertVer4FieldsToVer3 = data => {
  // // these SHOULD be extracted from nn::mii, however, AFAIK these are located...
  // ... in the CommonColorTable as four uint8s after the two Color3s
  const ToVer3GlassTypeTable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 1, 3, 7, 7, 6, 7, 8, 7, 7];
  const ToVer3HairColorTable = [0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 3, 5, 4, 4, 6, 2, 0, 6, 4, 3, 2, 2, 7, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4, 4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 5, 7, 5, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 0, 4, 4, 4, 4];
  const ToVer3EyeColorTable = [0, 2, 2, 2, 1, 3, 2, 3, 0, 1, 2, 3, 4, 5, 2, 2, 4, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 4, 4, 4, 4, 4, 4, 4, 1, 0, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1];
  const ToVer3MouthColorTable = [4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 1, 4, 4, 4, 0, 1, 2, 3, 4, 4, 2, 3, 3, 4, 4, 4, 4, 1, 4, 4, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4, 3, 3, 3, 3];
  const ToVer3GlassColorTable = [0, 1, 1, 1, 5, 1, 1, 4, 0, 5, 1, 1, 3, 5, 1, 2, 3, 4, 5, 4, 2, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5];
  const ToVer3FacelineColorTable = [0, 1, 2, 3, 4, 5, 0, 1, 5, 5];

  data.glassesType = ToVer3GlassTypeTable[data.glassesType];
  data.hairColor = ToVer3HairColorTable[data.hairColor];
  // NOTE: even though the rest of the beard fields are named differently
  // in Gen3Studio, this one for beard color is the same there and in all
  data.facialHairColor = ToVer3HairColorTable[data.facialHairColor];
  data.eyeColor = ToVer3EyeColorTable[data.eyeColor];
  data.mouthColor = ToVer3MouthColorTable[data.mouthColor];
  data.glassesColor = ToVer3GlassColorTable[data.glassesColor];
  data.faceColor = ToVer3FacelineColorTable[data.faceColor];
  return data;
};
// this function just calls the method above and also removes underscore keys
conversionMethods.convertStudioToVer3 = data => {
	data = conversionMethods.convertVer4FieldsToVer3(data);
  return removeUnderscoreKeysFromObject(data);
};


const handleConvertDetailsToggle = event => {
	if(!event.target.open // not toggled open? ignore
  		// or already revealed, we do not need to do anything
      || event.target.getAttribute('data-revealed'))
  	return;

	// we need to find the data
  // .. for now, take this from the parent's image url
  // TODO: has to be replaced since it will not always be in the url
  const hopefullyImage = event.target.parentElement.getElementsByTagName('img')[0];
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

	// run the function to convert the data from the image to raw studio data
	const studioData = convertDataToStudio(inputData);
  // "studio code" = raw studio data in hex
  // NOTE: three dots are only required if it is a uint8array which
  // it is only one if the input data is studio data directly
  const studioCode = [...studioData].map(byteToHex).join('');
	studioCodeElement.textContent = studioCode;

  const studioURLData = encodeStudioToObfuscatedHex(studioData);
  studioURLDataElement.textContent = studioURLData;


	// do this at the end bc it is most likely to fail
  const ver3StoreDataElement = event.target.getElementsByClassName('ver3storedata')[0];
  const inputFormat = findInputFormatFromSize(inputData.length);
  const newStoreDataLolMaybe = convertToVer3StoreDataWithoutChecksumPleaseRewrite(inputData, inputFormat);
  ver3StoreDataElement.textContent = uint8ArrayToBase64(newStoreDataLolMaybe);

	// mark as revealed at the end, i.e. do NOT RUN THE HANDLER ANYMORE
  event.target.setAttribute('data-revealed', '1');
};

// encodes a compatible struct to Ver3StoreData
/* NOTE: CURRENTLY DOES THESE ADDITIONAL (potentially undesirable) THINGS:
 * FORCE ENABLES COPYING
 * sets MiiVersion to 0x03, and birth platform to 3DS
   - both needed to scan as a qr code
 * DOES NOT SET CHECKSUM...
 */
const encodeVer3StoreDataFromStruct = dataStruct => {
  // set unmarked fields
  dataStruct.unknown1 = 0x03;
  // 3ds version mii, will scan as a qr code on 3ds and wii u
  // may already be set so using defineProperty on it
  Object.defineProperty(dataStruct, 'version', {
    value: 3
  });
  // mii needs a non-null name to scan
  // TODO: you may want to make this part of a hash or encoding or.. something
  // TODO: you have enough bytes to pack the studio info within all arbitrary data given
  // NOTE: NOTE: this is what the Coral account API returns
  // in its Mii data, along with random IDs, I assume they forge it from studio data
  if(!dataStruct.miiName)
    dataStruct.miiName = 'Mii';
  // setting system id and client id here are NOT necessary, but they can be randomized
  //origMii.systemId = [0, 0, 0, 0, 0, 0, 0, 0];
  // mii id on the other hand cannot be null
  // if you scan two miis with the same id (or potentially other ids)
  // then the system will think they are the same and not overwrite
  //origMii.avatarId = [128, 0, 0, 0];
  // TODO: make ALL RANDOM AVATAR IDS
  // TODO: ALL NUMBERS and ALSO RANDOM SYSTEM ID. MAYBE RANDOM (NINTENDO) MAC???

  // TODO: TODO: TODO: IF YOU ARE READING, ACTUALLY MAKE THIS
  // A HASH OF THE MII STUDIO DATA OR SOMETHING I THINK MAYBE
  if(!dataStruct.avatarId)
    dataStruct.avatarId = [128,
                           // should not exceed 256?
                           Math.floor(Math.random() * 257),
                           Math.floor(Math.random() * 257),
                           Math.floor(Math.random() * 257),
                          ];
  // finally, pwease make this copying 🥺
  Object.defineProperty(dataStruct, 'copying', {
    value: true
  });
  // mingle, or local only, is already initialized to false tho

  //origMii.clientId = [0, 0, 0, 0, 0, 0];
  return encode3DSStoreDataFromStructCopiedFromKazukiMiiEncode(dataStruct);
};

// TODO: please.
const convertToVer3StoreDataWithoutChecksumPleaseRewrite = (data, format) => {
  if(data && data.length === STUDIO_OBFUSCATED_LENGTH)
    data = studioURLObfuscationDecode(data);
  let dataStruct = createNewInstanceOfKaitaiStructFormat(format, data);
  if(format.className === 'Gen3Studio') {
    // TODO: TODO: MOVE THIS LOGIC AND LOGIC ABOVE ELSEWHERRRRRREEEEE
    dataStruct.facialHairBeard = dataStruct.beardGoatee;
    dataStruct.facialHairSize = dataStruct.beardSize;
    dataStruct.facialHairMustache = dataStruct.beardMustache;
    dataStruct.facialHairVertical = dataStruct.beardVertical;
  }
  if(format.toVer3Function !== undefined)
  	dataStruct = conversionMethods[format.toVer3Function](dataStruct);

	return encodeVer3StoreDataFromStruct(dataStruct);
}

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
// converting studio data needs this
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

// yes I'm aware that typing this function name is as long as the snippet itself
const uint8ArrayToBase64 = data => btoa(String.fromCharCode.apply(null, data));

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

// NOTE: customized for the kaitai by GPT-4o...
// ... and adapted from MiiInfoEditorCTR: https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/mii.js#L348
// 2024-08-10: tested to be accurate with: blanco, bro-mole-high, jasmine
const encode3DSStoreDataFromStructCopiedFromKazukiMiiEncode = data => {
  // Create buffer to store the encoded data
  let buf = new Uint8Array(0x48 + 20 + 2 + 2);  // 0x48 bytes + 20 bytes for creatorName + 2 bytes padding + 2 bytes checksum

  // unknown1 byte
  buf[0x00] = data.unknown1 || 0;

  // characterSet, regionLock, profanityFlag, and copying all packed into one byte
  buf[0x01] = ((data.characterSet || 0) << 4) |  // character set (2 bits), typically 0=JPN+USA+EUR, 1=CHN, 2=KOR, 3=TWN
              (((data.regionLock || 0) & 0x03) << 2) |  // region lock (2 bits), 0=no lock, 1=JPN, 2=USA, 3=EUR
              ((data.profanityFlag ? 1 : 0) << 1) |  // profanity flag (1 bit), 1 = contains profanity
              (data.copying ? 1 : 0);  // copying allowed (1 bit), 1 = copying allowed

  // mii position page index and slot index
  buf[0x02] = (data.miiPositionPageIndex & 0x0F) |  // page index (4 bits)
              ((data.miiPositionSlotIndex & 0x0F) << 4);  // slot index (4 bits)

  // version and unknown3 packed together
  buf[0x03] = (data.version << 4) |  // version (4 bits)
              (data.unknown3 & 0x0F);  // unknown, typically 0 (4 bits)

  // systemId: unique ID associated with the console, 8 bytes
  if(data.systemId !== undefined) {
    for (let i = 0; i < 8; i++) {
      buf[0x04 + i] = data.systemId[i] || 0;
    }
  }

  // avatarId: unique Mii ID, 4 bytes (REQUIRED)
  for (let i = 0; i < 4; i++) {
    buf[0x0C + i] = data.avatarId[i] || 0;
  }

  // clientId: MAC address of the creator's console, 6 bytes
  if(data.clientId !== undefined) {
    for (let i = 0; i < 6; i++) {
      buf[0x10 + i] = data.clientId[i] || 0;
    }
  }

  // padding, 2 bytes (usually 0)
  buf[0x16] = data.padding & 0xFF;
  buf[0x17] = (data.padding >> 8) & 0xFF;

  // data1: gender, birth month, birth day, favorite color, favorite flag
  buf[0x18] = (data.gender & 0x01) |  // gender (1 bit), 0 = male, 1 = female
              ((data.birthMonth & 0x0F) << 1) |  // birth month (4 bits)
              ((data.birthDay & 0x1F) << 5);  // birth day (5 bits)

  buf[0x19] = ((data.birthDay >> 3) & 0x03) |  // continuation of birth day (2 bits)
              ((data.favoriteColor & 0x0F) << 2) |  // favorite color (4 bits)
              ((data.favorite ? 1 : 0) << 6);  // favorite flag (1 bit)

  // mii name (REQUIRED), UTF-16LE encoded
  let nameBytes = new Uint8Array(new ArrayBuffer(20));
  for (let i = 0; i < data.miiName.length; i++) {
    new DataView(nameBytes.buffer).setUint16(i * 2, data.miiName.charCodeAt(i), true);  // little-endian UTF-16
  }
  buf.set(nameBytes, 0x1A);

  // height and weight
  buf[0x2E] = data.bodyHeight || 0;  // height (1 byte)
  buf[0x2F] = data.bodyWeight || 0;  // weight (1 byte)

  // face type (shape), skin color, and mingle settings
  buf[0x30] = ((data.faceColor & 0x07) << 5) |  // skin color (3 bits)
              ((data.faceType & 0x0F) << 1) |  // face shape (4 bits)
              (data.mingle ? 1 : 0);  // mingle (1 bit)

  // face makeup and wrinkles
  buf[0x31] = (data.faceWrinkles & 0x0F) |  // face wrinkles (4 bits)
              ((data.faceMakeup & 0x0F) << 4);  // face makeup (4 bits)

  // hair type, color, and flip
  buf[0x32] = data.hairType || 0;  // hair type (1 byte)
  buf[0x33] = (data.hairColor & 0x07) |  // hair color (3 bits)
              ((data.hairFlip ? 1 : 0) << 3) |  // hair flip (1 bit)
              ((data.unknown5 & 0x0F) << 4);  // unknown (4 bits)

  // eye details: type, color, size, stretch, rotation, horizontal spacing, vertical position
  let eyeDetails = (data.eyeType & 0x3F) |  // eye type (6 bits)
                   ((data.eyeColor & 0x07) << 6) |  // eye color (3 bits)
                   ((data.eyeSize & 0x07) << 9) |  // eye size (3 bits)
                   ((data.eyeStretch & 0x07) << 13) |  // eye stretch (3 bits)
                   ((data.eyeRotation & 0x1F) << 16) |  // eye rotation (5 bits)
                   ((data.eyeHorizontal & 0x0F) << 21) |  // eye horizontal spacing (4 bits)
                   ((data.eyeVertical & 0x1F) << 25);  // eye vertical position (5 bits)

  buf[0x34] = eyeDetails & 0xFF;
  buf[0x35] = (eyeDetails >> 8) & 0xFF;
  buf[0x36] = (eyeDetails >> 16) & 0xFF;
  buf[0x37] = (eyeDetails >> 24) & 0xFF;

  // eyebrow details: type, color, size, stretch, rotation, horizontal spacing, vertical position
  let eyebrowDetails = (data.eyebrowType & 0x1F) |  // eyebrow type (5 bits)
                       ((data.eyebrowColor & 0x07) << 5) |  // eyebrow color (3 bits)
                       ((data.eyebrowSize & 0x0F) << 8) |  // eyebrow size (4 bits)
                       ((data.eyebrowStretch & 0x07) << 12) |  // eyebrow stretch (3 bits)
                       ((data.eyebrowRotation & 0x0F) << 16) |  // eyebrow rotation (4 bits)
                       ((data.eyebrowHorizontal & 0x0F) << 21) |  // eyebrow horizontal spacing (4 bits)
                       ((data.eyebrowVertical & 0x1F) << 25);  // eyebrow vertical position (5 bits)

  buf[0x38] = eyebrowDetails & 0xFF;
  buf[0x39] = (eyebrowDetails >> 8) & 0xFF;
  buf[0x3A] = (eyebrowDetails >> 16) & 0xFF;
  buf[0x3B] = (eyebrowDetails >> 24) & 0xFF;

  // nose details: type, size, vertical position
  let noseDetails = (data.noseType & 0x1F) |  // nose type (5 bits)
                    ((data.noseSize & 0x0F) << 5) |  // nose size (4 bits)
                    ((data.noseVertical & 0x1F) << 9);  // nose vertical position (5 bits)

  buf[0x3C] = noseDetails & 0xFF;
  buf[0x3D] = (noseDetails >> 8) & 0xFF;

  // mouth details: type, color, size, stretch
  let mouthDetails = (data.mouthType & 0x3F) |  // mouth type (6 bits)
                     ((data.mouthColor & 0x07) << 6) |  // mouth color (3 bits)
                     ((data.mouthSize & 0x0F) << 9) |  // mouth size (4 bits)
                     ((data.mouthStretch & 0x07) << 13);  // mouth stretch (3 bits)

  buf[0x3E] = mouthDetails & 0xFF;
  buf[0x3F] = (mouthDetails >> 8) & 0xFF;

  // mouth2 details: vertical position, mustache type
  let mouth2Details = (data.mouthVertical & 0x1F) |  // mouth vertical position (5 bits)
                      ((data.facialHairMustache & 0x07) << 5);  // mustache type (3 bits)

  buf[0x40] = mouth2Details & 0xFF;
  buf[0x41] = (mouth2Details >> 8) & 0xFF;

  // beard details: type, color, size, vertical position
  let beardDetails = (data.facialHairBeard & 0x07) |  // beard type (3 bits)
                     ((data.facialHairColor & 0x07) << 3) |  // beard color (3 bits)
                     ((data.facialHairSize & 0x0F) << 6) |  // beard size (4 bits)
                     ((data.facialHairVertical & 0x1F) << 10);  // beard vertical position (5 bits)

  buf[0x42] = beardDetails & 0xFF;
  buf[0x43] = (beardDetails >> 8) & 0xFF;

  // glasses details: type, color, size, vertical position
  let glassesDetails = (data.glassesType & 0x0F) |  // glasses type (4 bits)
                       ((data.glassesColor & 0x07) << 4) |  // glasses color (3 bits)
                       ((data.glassesSize & 0x0F) << 7) |  // glasses size (4 bits)
                       ((data.glassesVertical & 0x0F) << 11);  // glasses vertical position (4 bits)

  buf[0x44] = glassesDetails & 0xFF;
  buf[0x45] = (glassesDetails >> 8) & 0xFF;

  // mole details: enable, size, horizontal position, vertical position
  let moleDetails = (data.moleEnable & 0x01) |  // mole enabled (1 bit)
                    ((data.moleSize & 0x0F) << 1) |  // mole size (4 bits)
                    ((data.moleHorizontal & 0x1F) << 5) |  // mole horizontal position (5 bits)
                    ((data.moleVertical & 0x1F) << 10);  // mole vertical position (5 bits)

  buf[0x46] = moleDetails & 0xFF;
  buf[0x47] = (moleDetails >> 8) & 0xFF;

  // creator name (optional), UTF-16LE encoded
  if(data.creatorName !== undefined) {
    let creatorNameBytes = new Uint8Array(new ArrayBuffer(20));
    for (let i = 0; i < data.creatorName.length; i++) {
      new DataView(creatorNameBytes.buffer).setUint16(i * 2, data.creatorName.charCodeAt(i), true);  // little-endian UTF-16
    }
    buf.set(creatorNameBytes, 0x48);
  }

  // padding2 and checksum (usually 0, depends on implementation)
  buf[0x5C] = data.padding2 & 0xFF;
  buf[0x5D] = (data.padding2 >> 8) & 0xFF;
  buf[0x5E] = data.checksum & 0xFF;
  buf[0x5F] = (data.checksum >> 8) & 0xFF;

  return buf;  // return the buffer containing the encoded StoreData
}

// deobfuscate the obfuscated studio url format
// from, and to, a Uint8Array (so requires converting from/to hex)
const studioURLObfuscationDecode = data => {
    const decodedData = new Uint8Array(data);
    const random = decodedData[0];
    let previous = random;

		// NOTE: THIS MAY GET AWAY WITH BEING 47, IDK
    for(let i = 1; i < 48; i++) {
        const encodedByte = decodedData[i];
        const original = (encodedByte - 7 + 256) % 256;
        decodedData[i - 1] = original ^ previous;
        previous = encodedByte;
    }

    return decodedData.slice(0, 46); // Return the first 46 bytes
}
