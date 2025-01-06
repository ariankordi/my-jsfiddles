//! maboii.js, the library for decrypting amiibo, at the end of this
//! the library is slightly modified to use SubtleCr*pto APIs instead of node cr*pto

const b64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
// key_retail.bin
const keyBuffer = b64ToBuffer('HRZLN1typVcouR1ktqPCBXVuZml4ZWQgaW5mb3MAAA7bS54/RSePOX7/m0+5kwAABEkX3Ha0lkDW+Dk5lg+u1O85L6qyFCiqIftU5UUFR2Z/dS0oc6IAF/74XAV1kEttbG9ja2VkIHNlY3JldAAAEP3IoHaUuJ5MR9N96M5cdMEESRfcdrSWQNb4OTmWD67U7zkvqrIUKKoh+1TlRQVHZg==');

const AMIIBO_STOREDATA_OFFSET = 0x4C;
const AMIIBO_STOREDATA_SIZE = 0x60;
const AMIIBO_NFPSTOREDATAEXTENTIONRAW_OFFSET = 0xBC;
const AMIIBO_NFPSTOREDATAEXTENTIONRAW_SIZE = 0x8;
const AMIIBO_COUNTRY_CODE_OFFSET = 0x2D;
const AMIIBO_NAME_OFFSET = 0x38;
const AMIIBO_MII_NAME_OFFSET = 0x66;
const AMIIBO_AND_MII_NAME_LENGTH = 0x14;

// html stuff
const resultList = document.getElementById('results');
const miiTemplate = document.getElementById('mii-template');

const parseMiiFromDecryptedAmiibo = unpacked => {
  const firstLi = miiTemplate.cloneNode(true);
  firstLi.id = '';
  // Append the cloned <li> to the top of the <ul>
  resultList.insertBefore(firstLi, resultList.firstChild);
  const newLi = resultList.children[0];
  // show it
  newLi.style.display = '';

	const amiiboName = extractUTF16FromU8(unpacked, AMIIBO_NAME_OFFSET, AMIIBO_AND_MII_NAME_LENGTH, false);
  newLi.getElementsByClassName('figure-name')[0].textContent = amiiboName;
  const miiName = extractUTF16FromU8(unpacked, AMIIBO_MII_NAME_OFFSET, AMIIBO_AND_MII_NAME_LENGTH, true);
  newLi.getElementsByClassName('mii-name')[0].textContent = miiName;

  const storeData = unpacked.slice(AMIIBO_STOREDATA_OFFSET, AMIIBO_STOREDATA_OFFSET+AMIIBO_STOREDATA_SIZE);
  
  const storeDataB64 = btoa(String.fromCharCode.apply(null, storeData));
  newLi.getElementsByClassName('base64-mii')[0].textContent = storeDataB64;

  const storeDataArrayBuffer = new Uint8Array(storeData).buffer;
  const origMii = new Gen2Wiiu3dsMiitomo(new KaitaiStream(storeDataArrayBuffer));

  // TODO: VERIFY CRC16 OF FFLSTOREDATA STRUCT
  // TODO: SUPPORT DECRYPTED AMIIBO? (DETECT BY CRC16?)
  // TODO: VERIFY NfpStoreDataExtentionRaw::IsValid 
  // TODO: CATCH ALL ERRORS IN JS, PRESENT THEM

	const studioMii = map3DSMiiToStudio(origMii);  
  
  // determine whether this amiibo data was registered on a switch
  // and judge if NFPStoreDataExtentionRaw should be used
  // based on that. TODO: I DON'T KNOW HOW TO DO THIS!!!!!!!
  
  // I looked into using a bitwise operation on the u64 application ID
  // as done in NfcDevice::GetAdminInfo in Citra and Yuzu
  // ... however I couldn't get that to work reliably
  // maybe I was just doing something wrong
  // here I'm going to use the fact that the
  // beginning of app data seems to be blank on Switch
  
  const afterStoreDataExtensionWithinAppDataShouldBeZero = unpacked.slice(AMIIBO_NFPSTOREDATAEXTENTIONRAW_OFFSET+AMIIBO_NFPSTOREDATAEXTENTIONRAW_SIZE,
  AMIIBO_NFPSTOREDATAEXTENTIONRAW_OFFSET+AMIIBO_NFPSTOREDATAEXTENTIONRAW_SIZE+0x14);
  
  const afterStoreDataExtensionWithinAppDataIsZero = afterStoreDataExtensionWithinAppDataShouldBeZero.every(number => number === 0)
    
  const useStoreDataExtension = afterStoreDataExtensionWithinAppDataIsZero
  // As well as an area of AppData after the extension being zero...
  // I found that if you write to an amiibo on (new) 3DS...
  // ... it will leave the extension there. Wii U doesn't.
  
  // This is the country code, which I found is zero from my Switch.
  && unpacked[AMIIBO_COUNTRY_CODE_OFFSET] === 0;

  if(useStoreDataExtension) {
    const storeDataExtension = unpacked.slice(AMIIBO_NFPSTOREDATAEXTENTIONRAW_OFFSET, AMIIBO_NFPSTOREDATAEXTENTIONRAW_OFFSET+AMIIBO_NFPSTOREDATAEXTENTIONRAW_SIZE);
    // nn::mii::detail::NFPStoreDataExtentionRaw (sic)
    // this struct should also be defined in Citra or Yuzu, forgot which at this point
    studioMii.faceColor = storeDataExtension[0];
    studioMii.hairColor = storeDataExtension[1];
    studioMii.eyeColor = storeDataExtension[2];
    studioMii.eyebrowColor = storeDataExtension[3];
    studioMii.mouthColor = storeDataExtension[4];
    studioMii.facialHairColor = storeDataExtension[5];
    studioMii.glassesColor = storeDataExtension[6];
    studioMii.glassesType = storeDataExtension[7];
  } else {
  	// use mii-unsecure api lmao???
    const studioURLCode = miiMap2Studio(Object.values(studioMii));
    newLi.getElementsByClassName('studio-url-data')[0].textContent = studioURLCode;
    newLi.getElementsByClassName('studio-code')[0].textContent = [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
    newLi.getElementsByClassName('mii')[0].src = `https://mii-unsecure.ariankordi.net/miis/image.png?width=270&data=${encodeURIComponent(storeDataB64)}`;
	  return;
  }

	const studioURLCode = miiMap2Studio(Object.values(studioMii));
  newLi.getElementsByClassName('studio-url-data')[0].textContent = studioURLCode;
  newLi.getElementsByClassName('studio-code')[0].textContent = [...new Uint8Array(Object.values(studioMii))].map(x => x.toString(16).padStart(2, '0')).join('');
	newLi.getElementsByClassName('mii')[0].src = `https://studio.mii.nintendo.com/miis/image.png?type=face&width=270&data=${studioURLCode}`;  
};

const unpackCallback = function(originalBuffer) {
  return unpackResult => {
    //console.log(unpackResult)
    // If decrypt is successful
    if(!unpackResult.result) {
      // TODO: REMOVE THIS HACK:
      // IDEALLY we should check if this is a decrypted amiibo by verifying the mii CRC16.
      // however a quicker solution is...
      // ... making sure the "0xA5" constant is in the same place as the decrypted format
      const originalU8 = new Uint8Array(originalBuffer);
      if(originalU8[0x28] === 0xA5) {
      	console.log('assuming this amiibo is decrypted and parsing it');
        return parseMiiFromDecryptedAmiibo(originalU8);
      }
      console.warn('AAAAAAAAAAAAAAAAAAAAAAAAAAAAA unpackResult.result FAILED');
      throw new Error('motherfucker this is not an amiibo');
      return;
    }
    // The plain data is available through unpackResult.unpacked
    const unpacked = unpackResult.unpacked;
    // console log the hex
    console.log([...new Uint8Array(unpacked)].map(x => x.toString(16).padStart(2, '0')).join(''));

    parseMiiFromDecryptedAmiibo(unpacked);
  }
}

// NOTE: wait for everything in maboii at the bottom to be loaded before calling into it
let keys;
window.onload = () => {
  keys = maboii.loadMasterKeys([...keyBuffer]);

  // Tom Nook Blue Jasmine.bin
  let dumpFileBuffer = b64ToBuffer('BCbAasqESYGGSA/g8RD/7qUABwB4RnhRWQWtTDJYrDlFrEpv9iS9mKQGGbgDJdEQRHpgSVnVkq49JRiXwSZw0hQI8yX62jAzfvS+p0pqJ2h512GvAYMAAAJCBQINEoUWZeSTaBI+3L7GincbCFZHCpsFl60nl/qThgnrhon7ynYWrimYkYCkJ7H/nS9vVvMm9RTse1Ujffr0ZNG2AAAD8fwnLC2OODIwQZquvY1rSBj/XWhFhQvJXU2JOBautFDl3Iry5ZXD78B2hNWCTrYU85Ehzzpr49RDsEK3ifrqzK0/21SJbmKCAshL8/4Mh1naUz1hsZT6oVd0xwrKmMLH3QflkCUwRxuc0Ym/RZezPqlfdhyZ2ANzWQ9oq70iqSFQin2ogmtVjyhnXcGF0ng1oho+wr5xzzxFnmZfsw1G4+/6RSotoYAvRC4W6Ch8ve4ke4iDDyYqIjStmNiOPXVmSd2/Vlzt+gyEqfR3ObNxNDkaWTeyMzDUH1yh7qWM8Kb+Ak1OVwpEu4T6wI6LY8kqwj9LmcjjqKRo8+fVngxz0tmqyvuwv21/nQAKbbX1yl9iuzETMOryBh58pIYYcjDU8ZWSOwzBv+pKDWmVDv1ZCOBhDqO3s2XWjh8I72dhC71XQZcb1TZUE7X0nPl6i4Et1vyK1IQvA6WtPiPH4uwvsDE1KH328xoeGwEAD70AAAAEXwAAAA==');

  maboii.unpack(keys, [...dumpFileBuffer]).then(unpackCallback(dumpFileBuffer));

}

window.onerror = msg => {
  // Handle image loading error
  var errorLiOriginal = document.getElementsByClassName('load-error');
  // get last error li, the original
  var errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
  errorLi.style.display = '';
  errorLi.textContent = msg.reason ? msg.reason : msg;
  resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
}
window.onunhandledrejection = window.onerror;

document.querySelector('input').addEventListener('change', event => {
  const reader = new FileReader();
  reader.onload = () => {
  	const arrayBuffer = reader.result;
    maboii.unpack(keys, [...new Uint8Array(arrayBuffer)]).then(unpackCallback(arrayBuffer));
  }
  reader.readAsArrayBuffer(event.target.files[0]);
});

// NOTE: NOTE: WARNING: WARNING: TODO: TODO: THIS CAN CREATE AN INFINITELY LONG STRING
function extractUTF16FromU8(buffer, startOffset, nameLength, isLittleEndian) {
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while(endPosition < startOffset + nameLength) {
    if(buffer[endPosition] === 0x00 && buffer[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
	const utf16leBytes = buffer.slice(startOffset, endPosition);
  // input is usually an array so we need to make it a Uint8Array
  const utf16leU8Array = new Uint8Array(utf16leBytes);
  const endian = isLittleEndian ? 'utf-16le' : 'utf-16be'
  return new TextDecoder(endian).decode(utf16leU8Array);
}

function map3DSMiiToStudio(origMii) {
  // instances from origMii named differently than Gen3Studio
	origMii.beardGoatee = origMii.facialHairBeard;
  origMii.beardSize = origMii.facialHairSize;
  origMii.beardMustache = origMii.facialHairMustache;
  origMii.beardVertical = origMii.facialHairVertical;
  // convert fields in origMii (3DS) to be compatible with switch/studio format
  // cannot just set these directly, have to set the properties
  Object.defineProperty(origMii, 'facialHairColor', {
    value: origMii.facialHairColor === 0 ? 8 : origMii.facialHairColor
  });
  Object.defineProperty(origMii, 'eyeColor', {
    value: origMii.eyeColor + 8
  });
  Object.defineProperty(origMii, 'eyebrowColor', {
    value: origMii.eyebrowColor === 0 ? 8 : origMii.eyebrowColor
  });
  Object.defineProperty(origMii, 'glassesColor', {
    value: origMii.glassesColor === 0 ? 8 : (origMii.glassesColor < 6 ? origMii.glassesColor + 13 : 0)
  });
  Object.defineProperty(origMii, 'hairColor', {
    value: origMii.hairColor === 0 ? 8 : origMii.hairColor
  });
  Object.defineProperty(origMii, 'mouthColor', {
    value: origMii.mouthColor < 4 ? origMii.mouthColor + 19 : 0
  });

  // create new blank Gen3Studio
  const studioMii = new Gen3Studio(new KaitaiStream(new ArrayBuffer(46)));

  for(const key in studioMii) {
      if(key.startsWith('_')) {
 		    // remove kaitai keys...
        // ... so that the only fields left
        // will literally map directly to studio format
        delete studioMii[key];
        continue;
      }
      // Check if the property exists in Gen2 and map it, otherwise log it
      if(origMii[key] !== undefined) {
        studioMii[key] = origMii[key];
      } else {
        console.warn(key + ' does not exist on origMii');
      }
      // excludes: beardGoatee, beardSize, beardMustache, beardVertical
    }
  // now it is ready
  return studioMii;
}
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






























const sc = window['crypt'+'o'].subtle; // Shortcut to SubtleCr*pto.
// ^^ Needed because jsfiddle blocks the keyword cr*pto for some reason

//! maboii.js: https://github.com/Entrivax/maboii.js
//! generated with tsc to ES6, and adapted for SubtleCr*pto
//! maboii export
var exports = {};
var maboii = exports;

var HMAC_POS_DATA = 0x008;
var HMAC_POS_TAG = 0x1B4;
var NFC3D_AMIIBO_SIZE = 540;
var DerivedKeys = /** @class */ (function () {
    function DerivedKeys() {
        this.aesKey = [];
        this.aesIV = [];
        this.hmacKey = [];
    }
    DerivedKeys.prototype.getByte = function (i) {
        if (i < 16) {
            return this.aesKey[i];
        }
        else if (i < 32) {
            return this.aesIV[i - 16];
        }
        else {
            return this.hmacKey[i - 32];
        }
    };
    DerivedKeys.prototype.setByte = function (i, val) {
        if (i < 16) {
            this.aesKey[i] = val;
            return;
        }
        else if (i < 32) {
            this.aesIV[i - 16] = val;
            return;
        }
        else {
            this.hmacKey[i - 32] = val;
            return;
        }
    };
    return DerivedKeys;
}());
var MasterKeys = /** @class */ (function () {
    function MasterKeys(data, tag) {
        this.data = data;
        this.tag = tag;
    }
    return MasterKeys;
}());
var MasterKey = /** @class */ (function () {
    function MasterKey(hmacKey, typeString, rfu, magicBytesSize, magicBytes, xorPad) {
        this.hmacKey = hmacKey;
        this.typeString = typeString;
        this.rfu = rfu;
        this.magicBytesSize = magicBytesSize;
        this.magicBytes = magicBytes;
        this.xorPad = xorPad;
    }
    return MasterKey;
}());
exports.loadMasterKeys = loadMasterKeys;
function loadMasterKeys(key) {
    var dataKey = readMasterKey(key, 0);
    var tagKey = readMasterKey(key, 80);
    if (dataKey.magicBytesSize > 16
        || tagKey.magicBytesSize > 16) {
        return null;
    }
    return new MasterKeys(dataKey, tagKey);
}
function readMasterKey(buffer, offset) {
    var hmacKey = [];
    var typeString = [];
    var rfu;
    var magicBytesSize;
    var magicBytes = [];
    var xorPad = [];
    var reader = new ArrayReader(buffer);
    for (var i = 0; i < 16; i++)
        hmacKey[i] = reader.readUInt8(offset + i);
    for (var i = 0; i < 14; i++)
        typeString[i] = reader.readInt8(offset + i + 16);
    rfu = reader.readUInt8(offset + 16 + 14);
    magicBytesSize = reader.readUInt8(offset + 16 + 14 + 1);
    for (var i = 0; i < 16; i++)
        magicBytes[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1);
    for (var i = 0; i < 32; i++)
        xorPad[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1 + 16);
    return {
        hmacKey: hmacKey,
        typeString: typeString,
        rfu: rfu,
        magicBytesSize: magicBytesSize,
        magicBytes: magicBytes,
        xorPad: xorPad
    };
}
var ArrayReader = /** @class */ (function () {
    function ArrayReader(buffer) {
        this.uint8 = new Uint8Array(buffer);
        this.int8 = new Int8Array(buffer);
    }
    ArrayReader.prototype.readUInt8 = function (index) {
        return this.uint8[index];
    };
    ArrayReader.prototype.readInt8 = function (index) {
        return this.int8[index];
    };
    return ArrayReader;
}());
exports.unpack = unpack;
async function unpack(amiiboKeys, tag) {
    var unpacked = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    var result = false;
    var internal = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    var dataKeys = new DerivedKeys();
    var tagKeys = new DerivedKeys();
    // Convert format
    tagToInternal(tag, internal);
    // Generate keys
    await amiiboKeygen(amiiboKeys.data, internal, dataKeys);
    await amiiboKeygen(amiiboKeys.tag, internal, tagKeys);
    // Decrypt
    await amiiboCipher(dataKeys, internal, unpacked);
    // Regenerate tag HMAC. Note: order matters, data HMAC depends on tag HMAC!
    await computeHmac(tagKeys.hmacKey, unpacked, 0x1D4, 0x34, unpacked, HMAC_POS_TAG);
    // Regenerate data HMAC
    await computeHmac(dataKeys.hmacKey, unpacked, 0x029, 0x1DF, unpacked, HMAC_POS_DATA);
    memcpy(unpacked, 0x208, tag, 0x208, 0x14);
    result = memcmp(unpacked, HMAC_POS_DATA, internal, HMAC_POS_DATA, 32) == 0 &&
        memcmp(unpacked, HMAC_POS_TAG, internal, HMAC_POS_TAG, 32) == 0;
    return {
        unpacked: unpacked,
        result: result
    };
}
exports.pack = pack;
async function pack(amiiboKeys, plain) {
    var packed = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    var cipher = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    var dataKeys = new DerivedKeys();
    var tagKeys = new DerivedKeys();
    // Generate keys
    await amiiboKeygen(amiiboKeys.tag, plain, tagKeys);
    await amiiboKeygen(amiiboKeys.data, plain, dataKeys);
    // Generated tag HMAC
    await computeHmac(tagKeys.hmacKey, plain, 0x1D4, 0x34, cipher, HMAC_POS_TAG);
    // Generate data HMAC
    var hmacBuffer = [].concat(plain.slice(0x029, 0x029 + 0x18B), cipher.slice(HMAC_POS_TAG, HMAC_POS_TAG + 0x20), plain.slice(0x1D4, 0x1D4 + 0x34));
    await computeHmac(dataKeys.hmacKey, hmacBuffer, 0, hmacBuffer.length, cipher, HMAC_POS_DATA);
    // Encrypt
    await amiiboCipher(dataKeys, plain, cipher);
    // Convert back to hardware
    internalToTag(cipher, packed);
    memcpy(packed, 0x208, plain, 0x208, 0x14);
    return packed;
}
function memcmp(s1, s1Offset, s2, s2Offset, size) {
    for (var i = 0; i < size; i++) {
        if (s1[s1Offset + i] !== s2[s2Offset + i]) {
            return s1[s1Offset + i] - s2[s2Offset + i];
        }
    }
    return 0;
}
function memcpy(destination, destinationOffset, source, sourceOffset, length) {
    var setDestinationByte = Array.isArray(destination) ?
        function (destination, i, value) {
            destination[i] = value;
        } : function (destination, i, value) {
        destination.setByte(i, value);
    };
    var getSourceByte = Array.isArray(source) ?
        function (source, i) {
            return source[i];
        } : function (source, i) {
        return source.getByte(i);
    };
    for (var i = 0; i < length; i++) {
        setDestinationByte(destination, destinationOffset + i, getSourceByte(source, sourceOffset + i));
    }
}
function memccpy(destination, destinationOffset, source, sourceOffset, character, length) {
    for (var i = 0; i < length; i++) {
        destination[destinationOffset + i] = source[sourceOffset + i];
        if (source[sourceOffset + i] == character) {
            return destinationOffset + i + 1;
        }
    }
    return null;
}
function memset(destination, destinationOffset, data, length) {
    for (var i = 0; i < length; i++) {
        destination[destinationOffset + i] = data;
    }
}
async function amiiboKeygen(masterKey, internalDump, derivedKeys) {
    var seed = [];
    amiiboCalcSeed(internalDump, seed);
    await keygen(masterKey, seed, derivedKeys);
}
function amiiboCalcSeed(internaldump, seed) {
    memcpy(seed, 0x00, internaldump, 0x029, 0x02);
    memset(seed, 0x02, 0x00, 0x0E);
    memcpy(seed, 0x10, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x18, internaldump, 0x1D4, 0x08);
    memcpy(seed, 0x20, internaldump, 0x1E8, 0x20);
}
function tagToInternal(tag, internal) {
    memcpy(internal, 0x000, tag, 0x008, 0x008);
    memcpy(internal, 0x008, tag, 0x080, 0x020);
    memcpy(internal, 0x028, tag, 0x010, 0x024);
    memcpy(internal, 0x04C, tag, 0x0A0, 0x168);
    memcpy(internal, 0x1B4, tag, 0x034, 0x020);
    memcpy(internal, 0x1D4, tag, 0x000, 0x008);
    memcpy(internal, 0x1DC, tag, 0x054, 0x02C);
}
function internalToTag(internal, tag) {
    memcpy(tag, 0x008, internal, 0x000, 0x008);
    memcpy(tag, 0x080, internal, 0x008, 0x020);
    memcpy(tag, 0x010, internal, 0x028, 0x024);
    memcpy(tag, 0x0A0, internal, 0x04C, 0x168);
    memcpy(tag, 0x034, internal, 0x1B4, 0x020);
    memcpy(tag, 0x000, internal, 0x1D4, 0x008);
    memcpy(tag, 0x054, internal, 0x1DC, 0x02C);
}
async function keygen(baseKey, baseSeed, derivedKeys) {
    var preparedSeed = [];
    keygenPrepareSeed(baseKey, baseSeed, preparedSeed);
    await drbgGenerateBytes(baseKey.hmacKey, preparedSeed, derivedKeys);
}
function keygenPrepareSeed(baseKey, baseSeed, output) {
    // 1: Copy whole type string
    var outputOffset = memccpy(output, 0, baseKey.typeString, 0, 0, 14);
    // 2: Append (16 - magicBytesSize) from the input seed
    var leadingSeedBytes = 16 - baseKey.magicBytesSize;
    memcpy(output, outputOffset, baseSeed, 0, leadingSeedBytes);
    outputOffset += leadingSeedBytes;
    // 3: Append all bytes from magicBytes
    memcpy(output, outputOffset, baseKey.magicBytes, 0, baseKey.magicBytesSize);
    outputOffset += baseKey.magicBytesSize;
    // 4: Append bytes 0x10-0x1F from input seed
    memcpy(output, outputOffset, baseSeed, 0x10, 16);
    outputOffset += 16;
    // 5: Xor last bytes 0x20-0x3F of input seed with AES XOR pad and append them
    for (var i = 0; i < 32; i++) {
        output[outputOffset + i] = baseSeed[i + 32] ^ baseKey.xorPad[i];
    }
    outputOffset += 32;
    return outputOffset;
}
async function drbgGenerateBytes(hmacKey, seed, output) {
    var DRBG_OUTPUT_SIZE = 32;
    var outputSize = 48;
    var outputOffset = 0;
    var temp = [];
    var iterationCtx = { iteration: 0 };
    while (outputSize > 0) {
        if (outputSize < DRBG_OUTPUT_SIZE) {
            await drbgStep(await initHmac(hmacKey, iterationCtx.iteration, seed), temp, 0, iterationCtx);
            memcpy(output, outputOffset, temp, 0, outputSize);
            break;
        }
        await drbgStep(await initHmac(hmacKey, iterationCtx.iteration, seed), output, outputOffset, iterationCtx);
        outputOffset += DRBG_OUTPUT_SIZE;
        outputSize -= DRBG_OUTPUT_SIZE;
    }
}

// Initializes an HMAC operation
async function initHmac(hmacKey, iteration, seed) {
    const key = await sc.importKey(
        "raw",
        new Uint8Array(hmacKey),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const data = new Uint8Array([(iteration >> 8) & 0x0f, (iteration >> 0) & 0x0f, ...seed]);
    return { key, data };
}

// Performs an HMAC step
async function drbgStep(hmac, output, outputOffset, iterationCtx) {
    iterationCtx.iteration++;
    const buf = new Uint8Array(await sc.sign("HMAC", hmac.key, hmac.data));
    memcpy(output, outputOffset, Array.from(buf), 0, buf.length);
}

// Compute HMAC
async function computeHmac(hmacKey, input, inputOffset, inputLength, output, outputOffset) {
    const key = await sc.importKey(
        "raw",
        new Uint8Array(hmacKey),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const result = new Uint8Array(await sc.sign(
        "HMAC",
        key,
        new Uint8Array(input).subarray(inputOffset, inputOffset + inputLength)
    ));
    memcpy(output, outputOffset, Array.from(result), 0, result.length);
}

// Encrypt data using AES-CTR
async function amiiboCipher(keys, input, output) {
    const key = await sc.importKey(
        "raw",
        new Uint8Array(keys.aesKey),
        { name: "AES-CTR" },
        false,
        ["encrypt"]
    );
    const buf = new Uint8Array(await sc.encrypt(
        { name: "AES-CTR", counter: new Uint8Array(keys.aesIV), length: 128 },
        key,
        new Uint8Array(input).subarray(0x02C, 0x02C + 0x188)
    ));

    memcpy(output, 0x02C, Array.from(buf), 0, 0x188);
    memcpy(output, 0, input, 0, 0x008);
    memcpy(output, 0x028, input, 0x028, 0x004);
    memcpy(output, 0x1D4, input, 0x1D4, 0x034);
}