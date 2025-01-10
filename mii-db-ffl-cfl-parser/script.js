// Constants for FFL_ODB.dat structure
var FFLI_DATABASE_MAGIC_OFFSET = 0; // u32
var FFLI_DATABASE_MIIDATA_OFFSET = 8; // Start of m_MiiDataOfficial array
var FFLI_MII_DATA_OFFICIAL_SIZE = 92; // 0x5C bytes
var FFLI_CREATE_ID_SIZE = 16; // 0x10 bytes
var TOTAL_MIIS = 3000; // Number of FFLiMiiDataOfficial entries
var NAME_OFFSET = 0x1A; // Starting offset for the name
var MAX_NAME_LENGTH = 10; // Maximum name length in characters

// Enums for endian swap types
var FFLI_SWAP_ENDIAN_TYPE_U8 = 0;
var FFLI_SWAP_ENDIAN_TYPE_U16 = 1;
var FFLI_SWAP_ENDIAN_TYPE_U32 = 2;

// Swap descriptor for FFLiMiiDataCore (from FFLiSwapEndianDesc)
var SWAP_ENDIAN_DESC = [
    { type: FFLI_SWAP_ENDIAN_TYPE_U32, count: 1 },  // miiVersion + bitfield fields
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 8 },  // authorID (8 bytes)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 10 }, // createID (10 bytes)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 2 },  // reserved
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 11 },// gender, birthDate, favoriteColor, name (10 UTF-16 chars)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 2 },  // reserved
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 12 } // creatorName (10 UTF-16 chars)
];

/**
  * Swap the endianness of a 16-bit unsigned integer.
  * @param {number} value - The 16-bit unsigned integer.
  * @return {number} - The endian-swapped 16-bit unsigned integer.
  */
function swapEndian16(value) {
    return ((value & 0xFF) << 8) | ((value & 0xFF00) >> 8);
}

/**
  * Swap the endianness of a 32-bit unsigned integer.
  * @param {number} value - The 32-bit unsigned integer.
  * @return {number} - The endian-swapped 32-bit unsigned integer.
  */
function swapEndian32(value) {
    return ((value & 0xFF) << 24) |
        ((value & 0xFF00) << 8) |
        ((value & 0xFF0000) >> 8) |
        ((value & 0xFF000000) >>> 24);
}

/**
  * Swap the endianness of an array of integers.
  * @param {Uint8Array} data - The byte array to swap.
  * @param {number} start - The starting offset in the array.
  * @param {number} count - The number of elements to swap.
  * @param {number} type - The type of elements (FFLI_SWAP_ENDIAN_TYPE_U8, U16, or U32).
  */
function swapEndianArray(data, start, count, type) {
    var size = type === FFLI_SWAP_ENDIAN_TYPE_U8 ? 1 :
    type === FFLI_SWAP_ENDIAN_TYPE_U16 ? 2 :
    4; // U32

    for (var i = 0; i < count; i++) {
        var index = start + (i * size);
        if (type === FFLI_SWAP_ENDIAN_TYPE_U16) {
            var value = (data[index] << 8) | data[index + 1];
            data[index] = value & 0xFF;
            data[index + 1] = (value >> 8) & 0xFF;
        } else if (type === FFLI_SWAP_ENDIAN_TYPE_U32) {
            var byte0 = data[index];       // First byte
            var byte1 = data[index + 1];   // Second byte
            var byte2 = data[index + 2];   // Third byte
            var byte3 = data[index + 3];   // Fourth byte

            // Rearrange bytes in place
            data[index] = byte3;
            data[index + 1] = byte2;
            data[index + 2] = byte1;
            data[index + 3] = byte0;
        }
        // U8 requires no swapping
    }
}

/**
  * Perform endian swapping on FFLiMiiDataCore and its fields based on SWAP_ENDIAN_DESC.
  * @param {Uint8Array} data - The byte array containing FFLiMiiDataOfficial.
  * @return {Uint8Array} - The endian-swapped data.
  */
function swapFFLiMiiDataCore(data) {
    var offset = 0;

    // Process the rest of the fields in the descriptor
    for (var i = 0; i < SWAP_ENDIAN_DESC.length; i++) {
        var desc = SWAP_ENDIAN_DESC[i];
        swapEndianArray(data, offset, desc.count, desc.type);
        offset += desc.count * (desc.type === FFLI_SWAP_ENDIAN_TYPE_U8 ? 1 : desc.type === FFLI_SWAP_ENDIAN_TYPE_U16 ? 2 : 4);
    }

    return data; // Swapped data
}


/**
  * Perform endian swapping on FFLiMiiDataOfficial.
  * @param {Uint8Array} data - The 92-byte FFLiMiiDataOfficial data.
  * @return {Uint8Array} - The endian-swapped data.
  */
function swapFFLiMiiDataOfficial(data) {
    // Create a copy of the data to modify
    var swapped = new Uint8Array(data);

    // Swap FFLiMiiDataCore fields using the description            
    swapFFLiMiiDataCore(swapped);

    // Swap m_CreatorName (UTF-16, 10 elements at offset 0x48)
    swapEndianArray(swapped, 0x48, 10, FFLI_SWAP_ENDIAN_TYPE_U16);

    return swapped;
}
/**
  * Convert a Uint8Array to a Base64 string.
  * @param {Uint8Array} bytes - The byte array to convert.
  * @return {string} - The Base64 encoded string.
  */
function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
  * Convert a UTF-16 encoded name to a string.
  * @param {Uint8Array} data - The byte array containing the UTF-16 name.
  * @param {number} offset - The offset where the name starts.
  * @param {number} maxLength - The maximum length of the name in characters.
  * @param {boolean} isLittleEndian - Whether the data is in little-endian format.
  * @return {string} - The decoded UTF-16 name as a string.
  */
function decodeUTF16Name(data, offset, maxLength, isLittleEndian) {
    var name = '';
    for (var i = 0; i < maxLength; i++) {
        var charCode;
        if (isLittleEndian) {
            charCode = (data[offset + 1] << 8) | data[offset];
        } else {
            charCode = (data[offset] << 8) | data[offset + 1];
        }

        // Stop if null terminator is encountered
        if (charCode === 0) {
            break;
        }

        name += String.fromCharCode(charCode);
        offset += 2;
    }
    return name;
}

/**
  * Check if all elements in an array are zero.
  * @param {Array} arr - The array to check.
  * @return {boolean} - True if all elements are zero, else false.
  */
function areAllZeros(arr) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== 0) {
            return false;
        }
    }
    return true;
}

/**
  * Process the uploaded FFL_ODB.dat file and display valid Mii data.
  * @param {ArrayBuffer} arrayBuffer - The file data as ArrayBuffer.
  */
function processFFLODB(arrayBuffer) {
    var uint8Array = new Uint8Array(arrayBuffer);

    // Calculate the total size expected for m_MiiDataOfficial
    var expectedSize = FFLI_DATABASE_MIIDATA_OFFSET + (TOTAL_MIIS * FFLI_MII_DATA_OFFICIAL_SIZE);
    if (uint8Array.length < expectedSize) {
        alert('Invalid FFL_ODB.dat file size. Actual size: ' + uint8Array.length);
        return;
    }

    var validMiis = [];

    for (var i = 0; i < TOTAL_MIIS; i++) {
        var offset = FFLI_DATABASE_MIIDATA_OFFSET + (i * FFLI_MII_DATA_OFFICIAL_SIZE);
        var miiData = uint8Array.subarray(offset, offset + FFLI_MII_DATA_OFFICIAL_SIZE);

        // Perform endian swapping
        var swappedData = swapFFLiMiiDataOfficial(miiData);

        // Extract FFLCreateID (bytes 4 to 20 within FFLiMiiDataOfficial)
        var createId = [];
        for (var j = 4; j < 20; j++) {
            createId.push(swappedData[j]);
        }

        // Check if FFLCreateID is all zeros
        if (!areAllZeros(createId)) {
            // Decode UTF-16 name
            var name = decodeUTF16Name(swappedData, NAME_OFFSET, MAX_NAME_LENGTH, true);

            // Extract roomIndex (4 bits) and positionInRoom (4 bits)
            //var roomIndex = (swappedData[3] >> 4) & 0x0F; // Upper 4 bits of byte 3
            //var positionInRoom = swappedData[3] & 0x0F;   // Lower 4 bits of byte 3

            // Encode Mii data to Base64
            var base64Mii = bytesToBase64(swappedData);

            // Add entry to the validMiis array as formatted text
            validMiis.push({
                name: name,
                //roomIndex: roomIndex,
				//positionInRoom: positionInRoom,
                base64: base64Mii
            });
        }
    }

    // Display the valid Mii data in a list
    displayMiis(validMiis);
}

/**
  * Display the list of valid Mii Base64 strings in the HTML.
  * @param {Array} miis - Array of Mii objects containing name, roomIndex, positionInRoom, and Base64 data.
  */
function displayMiis(miis) {
    var ul = document.getElementById('miiList');
    ul.innerHTML = ''; // Clear any existing content

    // Add text format description
    /*
            var formatDesc = document.createElement('li');
            formatDesc.textContent = 'Format: Name (Room Index/Position In Room): Base64 Data';
            ul.appendChild(formatDesc);
     */

    for (var i = 0; i < miis.length; i++) {
        var li = document.createElement('li');

        // Prefix with Name and Room Info
        li.textContent = miis[i].name + '\n';//`${miis[i].name} (${miis[i].roomIndex}/${miis[i].positionInRoom}): `;

        // Add Base64 in a code block
        var codeBlock = document.createElement('code');
        codeBlock.textContent = miis[i].base64;
        li.appendChild(codeBlock);

        // Add inner bullet with image
        var innerUl = document.createElement('ul');
        var innerLi = document.createElement('li');
        innerLi.innerHTML = '<img loading="lazy" src="https://mii-unsecure.ariankordi.net/miis/image.png?width=96&data=' + encodeURIComponent(miis[i].base64) + '"><br>';
        innerUl.appendChild(innerLi);
        li.appendChild(innerUl);

        ul.appendChild(li);
    }

    // Inform the user if no valid Miis were found
    if (miis.length === 0) {
        var li = document.createElement('li');
        li.textContent = 'No valid Mii data found.';
        ul.appendChild(li);
    }
}


/**
  * Handle the file input change event.
  * @param {Event} event - The change event.
  */
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    var reader = new FileReader();

    reader.onload = function(e) {
        var arrayBuffer = e.target.result;
        processFFLODB(arrayBuffer);
    };

    reader.onerror = function(e) {
        alert('Error reading file.');
    };

    // Read the file as ArrayBuffer for binary processing
    reader.readAsArrayBuffer(file);
}

// Uncomment the following block to use NWF's file reading implementation

// NWF File Reading Implementation
function onFFLODBRead(evt) {
    // Check if evt.data is a Blob
    if (!evt.data) {
        alert('Error: No data found in the event.');
        return;
    }

    var blob = evt.data; // The Blob from the event
    var reader = new FileReader();

    reader.onloadend = function () {
        if (reader.result) {
            // Convert text content to an ArrayBuffer
            var textData = reader.result; // Result is a string
            var arrayBuffer = new Uint8Array(textData.split('').map(function (char) {
                return char.charCodeAt(0);
            })).buffer;

            // Process the ArrayBuffer
            processFFLODB(arrayBuffer);
        } else {
            alert('Error: Failed to read Blob content.');
        }
    };

    reader.onerror = function () {
        alert('Error: Could not read Blob.');
    };

    // Read the Blob as text
    reader.readAsBinaryString(blob); // Use binary string to match expected content format
}


function onFFLODBReadFail() {
    alert('Failed to read FFL_ODB.dat file.');
}

/*
// Initialize NWF file reading on document ready
document.addEventListener('DOMContentLoaded', function () {
    try {
        var directory = new nwf.io.Directory("/vol/storage_mlc01/usr/save/00050010/1004a100/user/common/db/");
        var files = directory.listFiles();
        var FFL_ODB;

        for (var i = 0; i < files.length; i++) {
            if (files[i].fileName === "FFL_ODB" && files[i].fileExtension === "dat") {
                FFL_ODB = new nwf.io.File('FFL_ODB.dat', directory);
                FFL_ODB.addEventListener(nwf.events.IOEvent.READ_COMPLETE, onFFLODBRead);
                FFL_ODB.addEventListener(nwf.events.IOEvent.ERROR, onFFLODBReadFail);
                FFL_ODB.read();
                break;
            }
        }
    } catch (error) {
        alert("An error occurred while accessing the directory: " + error.message);
    }
});
*/
// Polyfill for btoa (base64 encoding) if not available
if (!window.btoa) {
    window.btoa = function (str) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var output = '';
        var block, charCode, idx = 0;

        str = String(str);
        while (idx < str.length) {
            block = (str.charCodeAt(idx++) << 16) |
                (str.charCodeAt(idx++) << 8) |
                str.charCodeAt(idx++);
            output += chars.charAt((block >> 18) & 0x3F) +
                chars.charAt((block >> 12) & 0x3F) +
                chars.charAt((block >> 6) & 0x3F) +
                chars.charAt(block & 0x3F);
        }

        var padding = str.length % 3;
        if (padding) {
            output = output.slice(0, padding - 3) + '==='.slice(padding);
        }

        return output;
    };
}

// Ensure the DOM is loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function () {
    var fileInput = document.getElementById('fileInput');
    if (fileInput.addEventListener) {
        fileInput.addEventListener('change', handleFileSelect, false);
    } else if (fileInput.attachEvent) { // For older IE versions
        fileInput.attachEvent('onchange', handleFileSelect);
    }
});