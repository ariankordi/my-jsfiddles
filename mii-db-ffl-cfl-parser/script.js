// @ts-check

// read the bottom of the file for official CFL structs!
var CFL_DB_IDENTIFIER = 'CFOG';
var FFL_ODB_IDENTIFIER = 'FFOC';
var DATABASE_MIIDATA_OFFSET = 8; // Start of m_MiiDataOfficial array, same for CFL_DB.dat as well.
var FFLI_MII_DATA_OFFICIAL_SIZE = 92; // 0x5C bytes
var FFL_CREATE_ID_SIZE = 10; // 0xA bytes
var TOTAL_MIIS = 3000; // Number of FFLiMiiDataOfficial entries
var TOTAL_MIIS_CFL = 100;
var NAME_OFFSET = 0x1A; // Starting offset for the name
var MAX_NAME_LENGTH = 10; // Maximum name length in characters

// Enums for endian swap types
var FFLI_SWAP_ENDIAN_TYPE_U8 = 0;
var FFLI_SWAP_ENDIAN_TYPE_U16 = 1;
var FFLI_SWAP_ENDIAN_TYPE_U32 = 2;

// Swap descriptor for FFLiMiiDataCore (from FFLiSwapEndianDesc)
var SWAP_ENDIAN_DESC = [
    { type: FFLI_SWAP_ENDIAN_TYPE_U32, count: 1 },  // miiVersion + bitfield fields
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 8 },   // authorID (8 bytes)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: FFL_CREATE_ID_SIZE }, // createID (10 bytes)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 2 },   // reserved
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 11 }, // gender, birthDate, favoriteColor, name (10 UTF-16 chars)
    { type: FFLI_SWAP_ENDIAN_TYPE_U8, count: 2 },   // reserved
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 12 }  // creatorName (10 UTF-16 chars)
];

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
 * @returns {Uint8Array} - The endian-swapped data.
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
 * @returns {Uint8Array} - The endian-swapped data.
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
 * @returns {string} - The Base64 encoded string.
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
 * @returns {string} - The decoded UTF-16 name as a string.
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
 * @param {Array<number>} arr - The array to check.
 * @returns {boolean} - True if all elements are zero, else false.
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
 * @param {ArrayBuffer|null} arrayBuffer - The file data as ArrayBuffer.
 */
function processFFLODB(arrayBuffer) {
    if (!arrayBuffer) {
        console.log('processFFLODB: arrayBuffer is null.');
        return;
    }
    var uint8Array = new Uint8Array(arrayBuffer);

  	// Will change depending on CFL_ODB or not:
    var isLittleEndian;
    var totalMiis;

  	// Verify the identifier, which is the first 4 bytes.
    var first4Bytes = uint8Array.subarray(0, 4);
    var magic = '';
    for (var i = 0; i < first4Bytes.length; i++) magic += String.fromCharCode(first4Bytes[i]);

    if (magic === FFL_ODB_IDENTIFIER) {
     	  isLittleEndian = false;
        totalMiis = TOTAL_MIIS;
    } else if (magic === CFL_DB_IDENTIFIER) {
     	  isLittleEndian = true;
        totalMiis = TOTAL_MIIS_CFL;
        // NOTE that CFL_DB.dat also contains the
        // structures: CFLiHiddenHeader, CFLiRecentDBFile
    } else {
     	  // Unknown magic
        alert('processFFLODB: Invalid FFL_ODB.dat/CFL_DB.dat file magic. Expected FFOC/CFOG, actual magic: ' + magic);
        return;
    }


    // Calculate the total size expected for m_MiiDataOfficial
    var expectedSize = DATABASE_MIIDATA_OFFSET + (totalMiis * FFLI_MII_DATA_OFFICIAL_SIZE);
    if (uint8Array.length < expectedSize) {
        alert('processFFLODB: Invalid FFL_ODB.dat file size. Actual size: ' + uint8Array.length);
        return;
    }

    var validMiis = [];

    for (var i = 0; i < totalMiis; i++) {
        var offset = DATABASE_MIIDATA_OFFSET + (i * FFLI_MII_DATA_OFFICIAL_SIZE);
        var miiData = uint8Array.subarray(offset, offset + FFLI_MII_DATA_OFFICIAL_SIZE);

        // Perform endian swapping
        if (!isLittleEndian) {
            miiData = swapFFLiMiiDataOfficial(miiData);
        }

        // Extract FFLCreateID (bytes 4 to 20 within FFLiMiiDataOfficial)
        var createId = [];
        for (var j = 4; j < 20; j++) {
            createId.push(miiData[j]);
        }

        // Check if FFLCreateID is all zeros
        if (!areAllZeros(createId)) {
            // Decode UTF-16 name
            var name = decodeUTF16Name(miiData, NAME_OFFSET, MAX_NAME_LENGTH, true);

            // Extract roomIndex (4 bits) and positionInRoom (4 bits)
            //var roomIndex = (miiData[3] >> 4) & 0x0F; // Upper 4 bits of byte 3
            //var positionInRoom = miiData[3] & 0x0F;   // Lower 4 bits of byte 3

            // Encode Mii data to Base64
            var base64Mii = bytesToBase64(miiData);

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
 * @param {Array<Object<string, *>>} miis - Array of Mii objects containing name, roomIndex, positionInRoom, and Base64 data.
 */
function displayMiis(miis) {
    var ul = document.getElementById('miiList');
    if (!ul) {
        alert('displayMiis: Element with ID "miiList" does not exist.');
        return;
    }
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
    var target = /** @type {HTMLInputElement} */ (event.target);
    if (!target || !target.files || !target.files[0]) {
        alert('No file selected.');
        return;
    }

    var file = target.files[0];

    var reader = new FileReader();

    reader.onload = function(e) {
        var arrayBuffer = /** @type {FileReader} */ (e.target).result;
        if (typeof arrayBuffer === 'string') {
            console.error('handleFileSelect / reader.onload: FileReader.result is string but ArrayBuffer was expected');
            return;
        }
        processFFLODB(arrayBuffer);
    };

    reader.onerror = function() {
        alert('handleFileSelect / reader.onerror: Error reading file.');
    };

    // Read the file as ArrayBuffer for binary processing
    reader.readAsArrayBuffer(file);
}

// Uncomment the following block to use NWF's file reading implementation

/**
 * NWF File Reading Implementation
 * @param {Event & {data: Blob}} evt
 */
function onFFLODBRead(evt) {
    // Check if evt.data is a Blob
    if (!evt.data) {
        alert('onFFLODBRead: evt.data is null or undefined.');
        return;
    }

    var blob = evt.data; // The Blob from the event
    var reader = new FileReader();

    reader.onloadend = function () {
        if (!reader.result) {
            alert('onFFLODBRead: reader.result is null or undefined, failed to read Blob content.');
            return;
        }
        // Convert text content to an ArrayBuffer
        var textData = reader.result; // Result is a string
        if (typeof textData !== 'string') {
            alert('onFFLODBRead / reader.onloadend: FileReader.result type is unexpectedly string');
            return;
        }
        var arrayBuffer = new Uint8Array(textData.split('').map(
            /**
             * @param {string} char
             * @returns {number}
             */
            function (char) {
                return char.charCodeAt(0);
            })).buffer;

        // Process the ArrayBuffer
        processFFLODB(arrayBuffer);
    };

    reader.onerror = function () {
        alert('onFFLODBRead / reader.onerror: Could not read Blob.');
    };

    // Read the Blob as text
    reader.readAsBinaryString(blob); // Use binary string to match expected content format
}

/*
function onFFLODBReadFail() {
    alert('nwf.events.IOEvent.ERROR / Failed to read FFL_ODB.dat file.');
}
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
        var block;
        var idx = 0;

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
    if (fileInput && fileInput.addEventListener) {
        fileInput.addEventListener('change', handleFileSelect, false);
    } else {
        alert('Could not find element fileInput.');
    }
});

// NOTE that CFL_DB.dat contains more interesting data!!!!
/*
struct CFLiIDTableData {
    struct CFLCreateID mCreateID; // 10 bytes
    u16 mNext:15;
    u16 mGender:1;
    u16 mPrev:15;
    u16 padding_0:1;
};

struct CFLiHiddenHeader {
    u32 identifier; // magic: CFHE (0x45484643)
    s16 mHead;
    s16 mTail;
    struct CFLiIDTableData data[3000];
};

struct CFLiCharDatabase {
    u32 identifier; // magic: CFOG (0x474f4643)
    u32 myMiiIndex:8;
    u32 isolation:1;
    u32 padding_0:23;
    struct CFLiPackedMiiDataOfficial rawdata[100]; // 92 bytes
    struct CFLiHiddenHeader hidden;
    u8 padding_1[14];
    u16 crc;
};

struct CFLiRecentDBFile {
    u32 mIdentifier; // magic: CFRA (0x41524643)
    s32 mDataSize;
    u8 mIndexArray[100];
    struct CFLiPackedMiiDataCore mDataArray[100]; // 72 bytes
    GLboolean mIsChanged;
    u8 padding_0[17];
    u16 crc;
};

// For reference, from FFL decomp
class FFLiDatabaseFileOfficial
{
...
private:
    u32                 m_Magic; // magic: FFOC (0x46464f43)
    u32                 m_SaveCount;
    FFLiMiiDataOfficial m_MiiDataOfficial[3000]; // 92 bytes
    FFLCreateID         m_CreateID[50]; // 10 bytes
    // Not written to by Mii Maker(?):
    u16                 _4381c[34 / sizeof(u16)];
    u16                 m_Crc;
}
*/