//import _ from 'https://debian.local:8445/assets/struct-fu/lib-browser-working.js';

//import { Buffer } from 'https://cdn.jsdelivr.net/npm/buffer@6.0.3/+esm';
//import _ from 'https://cdn.jsdelivr.net/npm/struct-fu@1.2.1/+esm';

function assertField(fieldName, actual, expected) {
    if (actual === expected) {
        console.log('%c' + fieldName + ': expected ' + expected + ', got ' + actual + ' ✅', 'color: green; font-weight: bold;');
    } else {
        console.error('%c' + fieldName + ': expected ' + expected + ', got ' + actual + ' ❌', 'color: red; font-weight: bold;');
    }
}

var stripSpaces = function(str) {
  return str.replace(/\s+/g, '');
};

var hexToUint8Array = function(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(function(byte) {
    return parseInt(byte, 16);
  }));
};

var base64ToUint8Array = function(base64) {
  // Replace URL-safe Base64 characters
  var normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

  // Custom function to pad the string with '=' manually
  var padBase64 = function(str) {
    while (str.length % 4 !== 0) {
      str += '=';
    }
    return str;
  };
  // Add padding if necessary
  var paddedBase64 = padBase64(normalizedBase64);
  var binaryString = atob(paddedBase64);
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

var uint8ArrayToBase64 = function(data) {
  return btoa(String.fromCharCode.apply(null, data));
};

var byteToHex = function(num) {
  return ('0' + num.toString(16)).slice(-2);
};

var parseHexOrB64TextStringToUint8Array = function(text) {
  var inputData;
  // decode it to a uint8array whether it's hex or base64
  var textData = stripSpaces(text);
  // check if it's base 16 exclusively, otherwise assume base64
  if (/^[0-9a-fA-F]+$/.test(textData))
    inputData = hexToUint8Array(textData);
  else
    inputData = base64ToUint8Array(textData);

  return inputData;
};

//var jasmineU8BE = parseHexOrB64TextStringToUint8Array('QAAAAwIAAATtsJuT3abq1g4nWEQAAAAAXVkASgBhAHMAbQBpAG4AZQAAAAAAABw3EBIBe24hHENkDRjHCACCHgANQTBbs22CAAAAbwBzAGkAZwBvAG4AYQBsAAA');
// var jasmineU8LE = parseHexOrB64TextStringToUint8Array('AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6');


// Define structs: ------------------------------------

var FFLiCreateID = _.struct([
    _.ubit('flag_normal', 1),
    _.ubit('flag_1', 1),
    _.ubit('flag_temporary', 1),
    _.ubit('flag_3', 1),
    _.ubit('create_date1', 14), // 28-bit field
    _.ubit('create_date2', 14), // 28-bit field
    _.byte('base', 6),
]);
var date_timestamp = function(createID) {
    var val28 = (createID.create_date1 << 14) | createID.create_date2;
    var timestamp = (val28 * 2) + 1262304000;
    return new Date(timestamp * 1000);
}

var FFLiAuthorID = _.struct([
    _.byte('data', 8)
]);

var FFLiMiiDataCore = _.struct([
    // 0x00: 32 bits
    //_.struct([
    _.ubitLE('mii_version', 8),     // LSB
    _.ubitLE('copyable', 1),
    _.ubitLE('ng_word', 1),
    _.ubitLE('region_move', 2),
    _.ubitLE('font_region', 2),
    _.ubitLE('reserved_0', 2),  // Unused padding
    _.ubitLE('room_index', 4),
    _.ubitLE('position_in_room', 4),
    _.ubitLE('author_type', 4),  // _0_24_27
    _.ubitLE('birth_platform', 3),
    _.ubitLE('reserved_1'),  // Unused (MSB)
    //]),

    // 0x04: author_id (8 bytes)
    _.struct('author_id', [FFLiAuthorID]),

    // 0x0C: creator_id (10 bytes)
    //_.byte('create_id', 10),
    _.struct('create_id', [FFLiCreateID]),

    // 0x16: padding (2 bytes)
    _.byte('reserved_2', 2),

    // 0x18: 16 bits for birthday and favorite
    _.ubitLE('gender', 1),         // LSB
    _.ubitLE('birth_month', 4),
    _.ubitLE('birth_day', 5),
    _.ubitLE('favorite_color', 4),
    _.ubitLE('favorite', 1),
    _.ubitLE('padding_0', 1),               // Placeholder (MSB)

    // 0x1A: name (UTF-16LE, 20 bytes)
    _.char16le('name', 20),

    // 0x2E: height and build
    _.uint8('height'),
    _.uint8('build'),

    // 0x30: 16 bits for face data
    _.ubitLE('localonly', 1),      // LSB
    _.ubitLE('face_type', 4),
    _.ubitLE('face_color', 3),
    _.ubitLE('face_tex', 4),
    _.ubitLE('face_make', 4),    // MSB

    // 0x32: 16 bits for hair data
    _.ubitLE('hair_type', 8),      // LSB
    _.ubitLE('hair_color', 3),
    _.ubitLE('hair_flip', 1),
    _.ubitLE('padding_1', 4),                   // Unused padding (MSB)

    // 0x34: 16 bits for eye data
    _.ubitLE('eye_type', 6),       // LSB
    _.ubitLE('eye_color', 3),
    _.ubitLE('eye_scale', 4),
    _.ubitLE('eye_aspect', 3),    // MSB

    // 0x36: 16 bits for eye positioning
    _.ubitLE('eye_rotate', 5),     // LSB
    _.ubitLE('eye_x', 4),
    _.ubitLE('eye_y', 5),
    _.ubitLE('padding_2', 2),                   // Unused padding (MSB)

    // 0x38: 16 bits for eyebrow data
    _.ubitLE('eyebrow_type', 5),   // LSB
    _.ubitLE('eyebrow_color', 3),
    _.ubitLE('eyebrow_scale', 4),
    _.ubitLE('eyebrow_aspect', 3),
    _.ubitLE('padding_3', 1),                   // Unused padding (MSB)

    // 0x3A: 16 bits for eyebrow positioning
    _.ubitLE('eyebrow_rotate', 5), // LSB
    _.ubitLE('eyebrow_x', 4),
    _.ubitLE('eyebrow_y', 5),
    _.ubitLE('padding_4', 2),                   // Unused padding (MSB)

    // 0x3C: 16 bits for nose data
    _.ubitLE('nose_type', 5),      // LSB
    _.ubitLE('nose_scale', 4),
    _.ubitLE('nose_y', 5),
    _.ubitLE('padding_5', 2),                   // Unused padding (MSB)

    // 0x3E: 16 bits for mouth data
    _.ubitLE('mouth_type', 6),     // LSB
    _.ubitLE('mouth_color', 3),
    _.ubitLE('mouth_scale', 4),
    _.ubitLE('mouth_aspect', 3),  // MSB

    // 0x40: 16 bits for mustache/mouth position
    _.ubitLE('mouth_y', 5), // LSB
    _.ubitLE('mustache_type', 3),
    _.ubitLE('padding_6', 8),                     // Unused padding (MSB)

    // 0x42: 16 bits for mustache/beard data
    _.ubitLE('beard_type', 3),       // LSB
    _.ubitLE('beard_color', 3),
    _.ubitLE('beard_scale', 4),
    _.ubitLE('beard_y', 5),
    _.ubitLE('padding_7', 1),                      // Unused padding (MSB)

    // 0x44: 16 bits for glasses data
    _.ubitLE('glasses_type', 4),     // LSB
    _.ubitLE('glasses_color', 3),
    _.ubitLE('glasses_scale', 4),
    _.ubitLE('glass_y', 5), // MSB

    // 0x46: 16 bits for mole data
    _.ubitLE('mole_type', 1),        // LSB
    _.ubitLE('mole_scale', 4),
    _.ubitLE('mole_x', 5),
    _.ubitLE('mole_y', 5),
    _.ubitLE('padding_8', 1)                      // Unused padding (MSB)
]);

// ---------------------------------------------------

// jasmine
var DEFAULT_MII_DATA = 'AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6';

function getBaseUrl() {
    return document.getElementById('base-url-input').value;
}

function renderHex(hex) {
    var img = document.getElementById('image');
    img.src = getBaseUrl() + hex;
    img.style.display = '';
}

function unpackedToJsonString(unpacked) {
    return JSON.stringify(unpacked, function(k, v) {
        if (v && v.constructor === Uint8Array) return Array.from(v).map(byteToHex).join('');
        return v;
    }, 2);
}

function processData(inputText) {
    var inputU8 = parseHexOrB64TextStringToUint8Array(inputText);

    var unpacked = FFLiMiiDataCore.unpack(inputU8);

    console.log('unpack result:', unpacked);
    console.log('miiVersion offset:', FFLiMiiDataCore.fields.mii_version.offset);
    console.log('fields:', FFLiMiiDataCore.fields);

    assertField('miiVersion', unpacked.mii_version, 3);
    assertField('regionMove', unpacked.region_move, 0);
    assertField('fontRegion', unpacked.font_region, 0);
    assertField('roomIndex', unpacked.room_index, 0);
    assertField('positionInRoom', unpacked.position_in_room, 0);
    assertField('authorType', unpacked.author_type, 0);
    assertField('birthPlatform', unpacked.birth_platform, 4);

    assertField('birthMonth', unpacked.birth_month, 12);
    assertField('birthDay', unpacked.birth_day, 10);

    assertField('build', unpacked.build, 55);

    assertField('favoriteColor', unpacked.favorite_color, 11);
    assertField('hairType', unpacked.hair_type, 123);
    assertField('beardColor', unpacked.beard_color, 6);
    assertField('glassY', unpacked.glass_y, 0xb);

    var hex = [].slice.call(new Uint8Array(
            FFLiMiiDataCore.pack(unpacked)
    )).map(byteToHex).join('');

    console.log('FFLiMiiDataCore hex:', hex);
    renderHex(hex);

    unpacked = FFLiMiiDataCore.unpack(FFLiMiiDataCore.pack(unpacked));
    console.log('pack then unpack result:', unpacked);
    console.log('this mii was made on:', date_timestamp(unpacked.create_id));
    //debugger

    document.getElementById('output').value = unpackedToJsonString(unpacked);
}

function jsonToFfsdAndRender() {
    var jsonText = document.getElementById('output').value;
    var parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (e) {
        // Silent: don't crash, just do nothing if JSON is invalid.
        console.warn('JSON parse error:', e.message);
        return;
    }
    // Re-hydrate hex strings back to Uint8Arrays for byte fields.
    function rehydrate(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        for (var k in obj) {
            if (typeof obj[k] === 'string' && /^[0-9a-f]*$/.test(obj[k]) && obj[k].length % 2 === 0 && obj[k].length > 0) {
                obj[k] = hexToUint8Array(obj[k]);
            } else if (typeof obj[k] === 'object') {
                rehydrate(obj[k]);
            }
        }
        return obj;
    }
    rehydrate(parsed);
    var hex = [].slice.call(new Uint8Array(
        FFLiMiiDataCore.pack(parsed)
    )).map(byteToHex).join('');
    renderHex(hex);
}

document.getElementById('mii-form').addEventListener('submit', function(e) {
    e.preventDefault();
    processData(document.getElementById('mii-input').value.trim() || DEFAULT_MII_DATA);
});

document.getElementById('json-to-ffsd-btn').addEventListener('click', jsonToFfsdAndRender);

document.getElementById('base-url-input').addEventListener('change', function() {
    var currentHex = document.getElementById('image').src.split('data=')[1];
    if (currentHex) {
        renderHex(currentHex);
    }
});

// Auto-run on load with default value.
window.addEventListener('load', function() {
    processData(DEFAULT_MII_DATA);
});