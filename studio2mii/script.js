// NOTE: taken from jsfiddle from 2018. probably not the most efficient way to do this?
// miiMap2Studio converts a mii "map" array with mii traits to a value that can be rendered by studio.mii.nintendo.com.
function miiMap2Studio(map) {
	// map will be modified
	const len = map.length;
  // make some random int
  const random = 0//Math.floor(256 * Math.random());
  // randomCopy will be modified
  let randomCopy = random;
  for(let i = 0; i < len; i++) {
  	map[i] = (7 + (map[i] ^ randomCopy)) % 256;
    randomCopy = map[i];
  }
  return [random].concat(map).map(i => {
  	for(var byte = (i % 256).toString(16); byte.length < 2;) {
    	byte = '0' + byte;
    }
    return byte;
  }).join('');
}
// ABOVE: THIS IS UNUSED, JUST FOR REFERENCE


// the below REVERSES THE PROCESS!!!!! (gpt4 generated)

function decodeStudioURLData(bytes) {
  // The first byte is the random seed used in encoding
  const random = bytes.shift();
  let previous = random;
  const originalMap = [];

  // Reverse the encoding process
  bytes.forEach((encodedByte) => {
    // Reverse the modulation and XOR to find the original byte
    let original = (encodedByte - 7 + 256) % 256; // reverse the addition of 7
    original ^= previous; // reverse the XOR with the previous encoded byte
    originalMap.push(original);
    previous = encodedByte; // update previous to the current encoded byte for next iteration
  });

  return originalMap;
}



// PURELY for comparison purposes
//const originalMii = new Gen2Wiiu3dsMiitomo(new KaitaiStream(Uint8Array.from(atob('AwAAQOCDOaQApKAw1cm5ZxJtxn9+xgAATWpBAGsAaQBoAG8AAABzAAAAYwBoAGBVAFNVAThsYxosFEUUgRDZKg0AACmDWwhFdABlAHQAZQAAAHkAAAAAAAAAAAAAAHQ7'), c => c.charCodeAt(0))))

/*
const hex = '08014a030c04041f020c0308050415020a0109000006001104030a0800427203010314031303120e04000a030609'
const studioRawData = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
  return parseInt(h, 16)
}))
*/
//const studioRawData = new Uint8Array(decodeStudioURLData('59585f858d8c9698c0c9cbcfced0dbdde2f0f7fefe05070d414d55665b62203a454c5548554d53484b565d5e656c76'));

// TODO: VERIFY THIS?
const dataInput = document.getElementById('miiDataInput');
const resultList = document.getElementById('result-list');

function studioTob64Gen2StoreDataDisplay(event) {
	event.preventDefault();
	// one liner hex to raw ARRAY - not typed  
  const studioRawBytes = Array.from(dataInput.value.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  // use unencoded studio data directly, unless
  let studioRawArray = studioRawBytes;
  // if the hex is 92 characters/46 bytes long equals it's already decoded/decrypt?ed
  if(studioRawBytes.length !== 46) {
  	// normal length
    studioRawArray = decodeStudioURLData(studioRawBytes);
  }
  //const studioRawArray = decodeStudioURLData(dataInput.value);
  const studioRawArrayU8 = new Uint8Array(studioRawArray);
  
  
  const studioMii = new Gen3Studio(new KaitaiStream(studioRawArrayU8.buffer));

  // create new blank Gen2Wiiu3dsMiitomo
  const origMii = new Gen2Wiiu3dsMiitomo(new KaitaiStream(new ArrayBuffer(96)));

  // Convert fields in gen3Studio back to origMii (3DS) compatible format
  studioMii.facialHairColor = studioMii.facialHairColor === 8 ? 0 : studioMii.facialHairColor;
  studioMii.eyeColor = studioMii.eyeColor - 8;
  studioMii.eyebrowColor = studioMii.eyebrowColor === 8 ? 0 : studioMii.eyebrowColor;
  studioMii.glassesColor = studioMii.glassesColor === 8 ? 0 : (studioMii.glassesColor > 13 ? studioMii.glassesColor - 13 : studioMii.glassesColor);
  studioMii.hairColor = studioMii.hairColor === 8 ? 0 : studioMii.hairColor;
  studioMii.mouthColor = studioMii.mouthColor >= 19 ? 0 : studioMii.mouthColor - 19;

  // fields that map directly
  origMii.bodyHeight = studioMii.bodyHeight;
  origMii.bodyWeight = studioMii.bodyWeight;
  origMii.faceColor = studioMii.faceColor;
  origMii.faceType = studioMii.faceType;

  origMii.faceMakeup = studioMii.faceMakeup;
  origMii.faceWrinkles = studioMii.faceWrinkles;

  origMii.gender = studioMii.gender;

  origMii.hairFlip = studioMii.hairFlip;
  origMii.hairType = studioMii.hairType;
  origMii.hairColor = studioMii.hairColor;


	// these don't have to be set i think
  /*studioMii.birthDay = 1;
  studioMii.birthMonth = 1;
  */
  //studioMii.favorite = false;

  // BIT FIELD MAPPING

  // data1 field mapping
  origMii.data1 |= (studioMii.favorite & 0x01) << 14;
  origMii.data1 |= (studioMii.favoriteColor & 0x0F) << 10;
  origMii.data1 |= (studioMii.birthDay & 0x1F) << 5;
  origMii.data1 |= (studioMii.birthMonth & 0x0F) << 1;
  origMii.data1 |= studioMii.gender & 0x01;

  //origMii.data1 = 27213
  // eye field mapping
  origMii.eye |= (studioMii.eyeVertical & 31) << 25;
  origMii.eye |= (studioMii.eyeHorizontal & 15) << 21;
  origMii.eye |= (studioMii.eyeRotation & 31) << 16;
  origMii.eye |= (studioMii.eyeStretch & 7) << 13;
  origMii.eye |= (studioMii.eyeSize & 7) << 9;
  origMii.eye |= (studioMii.eyeColor & 7) << 6;
  origMii.eye |= (studioMii.eyeType & 63);

  // eyebrow field mapping
  origMii.eyebrow |= (studioMii.eyebrowVertical & 31) << 25;
  origMii.eyebrow |= (studioMii.eyebrowHorizontal & 15) << 21;
  origMii.eyebrow |= (studioMii.eyebrowRotation & 15) << 16;
  origMii.eyebrow |= (studioMii.eyebrowStretch & 7) << 12;
  origMii.eyebrow |= (studioMii.eyebrowSize & 15) << 8;
  origMii.eyebrow |= (studioMii.eyebrowColor & 7) << 5;
  origMii.eyebrow |= (studioMii.eyebrowType & 31);

  // nose field mapping
  origMii.nose |= (studioMii.noseVertical & 31) << 9;
  origMii.nose |= (studioMii.noseSize & 15) << 5;
  origMii.nose |= (studioMii.noseType & 31);

  // mouth field mapping
  origMii.mouth |= (studioMii.mouthStretch & 7) << 13;
  origMii.mouth |= (studioMii.mouthSize & 15) << 9;
  origMii.mouth |= (studioMii.mouthColor & 7) << 6; // inaccurate
  origMii.mouth |= (studioMii.mouthType & 63);
  //needs to be 10969

  // mouth2 field mapping
  origMii.mouth2 |= (studioMii.mouthVertical & 31);
  origMii.mouth2 |= (studioMii.facialHairMustache & 7) << 5;

  // beard field mapping
  // BEARD STUFF HAS DIFFERENT NAME ON STUDIOMII
  origMii.beard |= (studioMii.beardVertical & 31) << 10;
  origMii.beard |= (studioMii.beardSize & 15) << 6;
  origMii.beard |= (studioMii.facialHairColor & 7) << 3;
  origMii.beard |= (studioMii.beardGoatee & 7);
  // needs to be 10496

  // glasses field mapping
  /*origMii.glasses |= (studioMii.glassesVertical & 15) << 11;
  origMii.glasses |= (studioMii.glassesSize & 11) << 7; //!
  origMii.glasses |= (studioMii.glassesColor & 7) << 4;
  origMii.glasses |= (studioMii.glassesType & 15);
  */origMii.glasses = (studioMii.glassesVertical << 11) | (studioMii.glassesSize << 7) | (studioMii.glassesColor << 4) | studioMii.glassesType
  // inaccurate
  // needs to be 23427

  // mole field mapping
  /*origMii.mole |= (studioMii.moleEnable & 1) << 15;
  origMii.mole |= (studioMii.moleVertical & 31) << 10;
  origMii.mole |= (studioMii.moleHorizontal & 31) << 5;
  origMii.mole |= (studioMii.moleSize & 15) << 1;
  */
  origMii.mole = (studioMii.moleEnable << 15) | (studioMii.moleVertical << 10) | (studioMii.moleHorizontal << 5) | studioMii.moleSize;
  // inaccurate

  // DEFAULTS
  origMii.unknown1 = 0x03;
	// 3ds version mii, will scan as a qr code on 3ds and wii u
  origMii.version = 3;
  //origMii.creatorName = '!';
  // mii needs a non-null name to scan
  // TODO: you may want to make this part of a hash or encoding or.. something
  // TODO: you have enough bytes to pack the studio info within all arbitrary data given
  origMii.miiName = 'yes name';
  // setting system id and client id here are NOT necessary, but they can be randomized
  //origMii.systemId = [0, 0, 0, 0, 0, 0, 0, 0];
  // mii id on the other hand cannot be null
  origMii.avatarId = [128, 0, 0, 0];
  //origMii.clientId = [0, 0, 0, 0, 0, 0];
	// TODO: tried to mark enable copying here but did not work???

  const storeData = packGen2ToStoreData(origMii);

  const base64Data = btoa(String.fromCharCode.apply(null, storeData)); // Convert Uint8Array to Base64
  const li = document.createElement('li');
  const pre = document.createElement('pre');
  pre.textContent = base64Data;
  li.style.color = getRandomPastelColor();
  
  li.appendChild(pre);
  
  resultList.insertBefore(li, resultList.firstChild);
}
function getRandomPastelColor() {
  const mix = [255, 255, 224]; // Light yellow will help in making pastel colors
  const base = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
  const pastel = base.map((val, index) => Math.round((val + mix[index]) / 2));
  return `rgb(${pastel.join(', ')})`;
}

// i tested the below function to be ACCURATE
// and should be able to convert a kaitai gen2 mii
// back into an original StoreData structure
function packGen2ToStoreData(mii) {
  const buffer = new ArrayBuffer(96); // Total bytes computed from the structure provided
  const dataView = new DataView(buffer);

  // Simple byte and string writing
  dataView.setUint8(0, mii.unknown1);
  //dataView.setUint8(1, (mii.characterSet << 6) | (mii.regionLock << 4) | (mii.profanityFlag << 3) | (mii.copying << 2) | mii.unknown2);
  // TOP is inaccurate!!!
  // HACK: set to 0x01 to enable copying
  // discards character set, region lock, ng word, and real copying
  // ... but none of these fields are on studio miis to begin with?
  dataView.setUint8(1, 0x01);
  dataView.setUint8(2, (mii.miiPositionSlotIndex << 4) | mii.miiPositionPageIndex);
  dataView.setUint8(3, (mii.version << 4) | mii.unknown3);
  
  // Writing system_id, avatar_id, client_id
  mii.systemId.forEach((id, index) => {
    dataView.setUint8(4 + index, id);
  });
  mii.avatarId.forEach((id, index) => {
    dataView.setUint8(12 + index, id);
  });
  mii.clientId.forEach((id, index) => {
    dataView.setUint8(16 + index, id);
  });

  // Padding and data1
  dataView.setUint16(22, mii.padding, true); // Little endian
  dataView.setUint16(24, mii.data1, true);
  //dataView.setUint16(24, (mii.favorite << 14) | (mii.favoriteColor << 10) | (mii.birthDay << 5) | (mii.birthMonth << 1) | mii.gender, true);

  // Mii name (UTF-16LE encoding)
  for (let i = 0; i < mii.miiName.length; i++) {
    dataView.setUint16(26 + i * 2, mii.miiName.charCodeAt(i), true);
  }

  // Body features
  dataView.setUint8(46, mii.bodyHeight);
  dataView.setUint8(47, mii.bodyWeight);
  dataView.setUint8(48, (mii.faceColor << 5) | (mii.faceType << 1) | mii.mingle);
  dataView.setUint8(49, (mii.faceMakeup << 4) | mii.faceWrinkles);

  // Hair features
  dataView.setUint8(50, mii.hairType);
  let hairBits = (mii.unknown5 << 5) | (mii.hairFlip << 4) | mii.hairColor;
  dataView.setUint8(51, hairBits); // Packed hair bits
  // Encode larger fields for eyes, eyebrows, etc.
  let eyeBits = (mii.eye & 0xFFFFFFFF);
  let eyebrowBits = (mii.eyebrow & 0xFFFFFFFF);
  dataView.setUint32(52, eyeBits, true);
  dataView.setUint32(56, eyebrowBits, true);

  // Nose, mouth, etc.
  dataView.setUint16(60, mii.nose, true);
  dataView.setUint16(62, mii.mouth, true);
  dataView.setUint16(64, mii.mouth2, true);
  dataView.setUint16(66, mii.beard, true);
  dataView.setUint16(68, mii.glasses, true);
  dataView.setUint16(70, mii.mole, true);

  // Creator name (UTF-16LE encoding)
  for (let i = 0; i < mii.creatorName.length; i++) {
    dataView.setUint16(72 + i * 2, mii.creatorName.charCodeAt(i), true);
  }

  // Final padding and checksum
  dataView.setUint16(92, mii.padding2, true);
  dataView.setUint16(94, mii.checksum, true);

	// crc16 the data!!!
	const dataPreChecksum = new Uint8Array(buffer).slice(0, -2);
  
  const newChecksum = crc16(dataPreChecksum);
  function toByteArray(num) {
    return [(num >> 8) & 0xFF, num & 0xFF];
  }
  return new Uint8Array([...dataPreChecksum, ...toByteArray(newChecksum)]);
}


function crc16(data) {
  let crc = 0;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for (let i = 0; i < data.length; i++) {
    let c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  crc = (msb << 8) + lsb;
  return crc;
}

/*
const storeData = packGen2ToStoreData(origMii);
console.log(btoa(String.fromCharCode.apply(null, storeData)))
*/
// for console debugging

// now it is ready