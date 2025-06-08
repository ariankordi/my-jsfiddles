// @ts-check

/* eslint @stylistic/indent: ['error', 4] -- Define indent rules. */
/* eslint no-var: "off", prefer-const: "off", -- Configure for ES5 environment. */
/* eslint @stylistic/no-multi-spaces: 'off' -- Allow spaces after comments. */

// read the bottom of the file for official CFL structs!
var CFL_DB_IDENTIFIER = 'CFOG';
var FFL_ODB_IDENTIFIER = 'FFOC';
/** Start of m_MiiDataOfficial (Mii data) array, same for CFL_DB.dat as well. */
var DATABASE_MIIDATA_OFFSET = 8;
/** Size of FFLiMiiDataOfficial/CFLiPackedMiiDataOfficial - 0x5C bytes. */
var FFLI_MII_DATA_OFFICIAL_SIZE = 92;
/** Size of FFLCreateID/Ver3CreateId - 0xA bytes. */
var FFL_CREATE_ID_SIZE = 10;
/** Total data entries for FFLiDatabaseFileOfficial. */
var TOTAL_MIIS = 3000;
var TOTAL_MIIS_CFL = 100;
/** Starting offset of the name in FFLiMiiDataCore/Ver3StoreData. */
var NAME_OFFSET = 0x1A;
/** Length for Mii names as UTF-16 characters. */
var MAX_NAME_LENGTH = 10;

/**
 * Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/FFLiSwapEndian.h#L8
 * @enum {number}
 */
var SwapEndianType = {
    U8: 0,
    U16: 1,
    U32: 2
};

/** Maps {@link SwapEndianType} endian swap type to byte size. */
var swapEndianTypeToSize = [1, 2, 4];

/** @typedef {Array<{type: SwapEndianType, count: number}>} SwapEndianDesc */

/**
 * Swap descriptor for FFLiMiiDataCore (from FFLiSwapEndianDesc)
 * Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiMiiDataCore.cpp#L6
 * @type {SwapEndianDesc}
 */
var SwapEndianDescCore = [
    { type: SwapEndianType.U32, count: 1 },  // miiVersion + personal, bitfields
    { type: SwapEndianType.U8,  count: 8 },  // authorID (8 bytes)
    { type: SwapEndianType.U8,  count: FFL_CREATE_ID_SIZE }, // createID (10 bytes)
    { type: SwapEndianType.U8,  count: 2 },  // reserved
    { type: SwapEndianType.U16, count: 11 }, // gender, birthDate, favoriteColor, name
    { type: SwapEndianType.U8,  count: 2 },  // reserved
    { type: SwapEndianType.U16, count: 12 }  // creatorName (10 UTF-16 chars)
];

/**
 * Swap the endianness of an array of integers.
 * Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/FFLiSwapEndian.h#L29
 * @param {Uint8Array} data - The byte array to swap.
 * @param {number} start - The starting offset in the array.
 * @param {number} count - The number of elements to swap.
 * @param {number} type - The type of elements (FFLI_SWAP_ENDIAN_TYPE_U8, U16, or U32).
 */
function swapEndianImpl(data, start, count, type) {
    var size = swapEndianTypeToSize[type];

    for (var i = 0; i < count; i++) {
        var index = start + (i * size);
        switch (type) {
            case SwapEndianType.U16: {
                var value = (data[index] << 8) | data[index + 1];
                data[index] = value & 0xFF;
                data[index + 1] = (value >> 8) & 0xFF;
                break;
            }
            case SwapEndianType.U32: {
                /** First byte. */
                var byte0 = data[index];
                /** Second byte. */
                var byte1 = data[index + 1];
                /** Third byte. */
                var byte2 = data[index + 2];
                /** Fourth byte. */
                var byte3 = data[index + 3];

                // Rearrange bytes in place
                data[index] = byte3;
                data[index + 1] = byte2;
                data[index + 2] = byte1;
                data[index + 3] = byte0;
                break;
            }
            case SwapEndianType.U8:
                // U8 requires no swapping.
                break;
        }
    }
}

/**
 * Perform endian swapping on FFLiMiiDataCore and its fields based on a SwapEndianDesc array.
 * @param {Uint8Array} data - The byte array to swap endian on.
 * @param {SwapEndianDesc} swapEndianDesc - The SwapEndanDesc array to use.
 */
function swapEndianArray(data, swapEndianDesc) {
    var offset = 0;
    // Process the fields in the descriptor
    for (var i = 0; i < swapEndianDesc.length; i++) {
        var desc = swapEndianDesc[i];
        swapEndianImpl(data, offset, desc.count, desc.type);

        var size = swapEndianTypeToSize[desc.type];
        offset += desc.count * size;
    }
}

/**
 * Perform endian swapping on FFLiMiiDataOfficial.
 * @param {Uint8Array} data - The 92-byte FFLiMiiDataOfficial data.
 */
function swapFFLiMiiDataOfficial(data) {
    // Swap FFLiMiiDataCore fields using the description
    swapEndianArray(data, SwapEndianDescCore);

    // Swap m_CreatorName (UTF-16, 10 elements at offset 0x48)
    swapEndianImpl(data, 0x48, 10, SwapEndianType.U16);
}

/**
 * Calculates the CRC-16/CCITT checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 * @param {Uint8Array} input - The byte array containing the data over which to compute the checksum.
 * @param {number} length - The number of bytes from the input array to process.
 * @returns {number} The calculated CRC-16/CCITT checksum as a number.
 */
function crc16(input, length) {
    /** Starting CRC value. */
    var crc = 0x0000;

    /** The most significant byte (MSB) from the initial CRC. Obtained by shifting right 8 bits. */
    var msb = crc >> 8;
    /** The least significant byte (LSB) from the initial CRC. Mask with 0xFF to get only the lower 8 bits. */
    var lsb = crc & 0xFF;

    // Process each byte in the input.
    for (var i = 0; i < length; i++) {
        // XOR the byte value with the current MSB.
        // This step introduces the data into the checksum calculation.
        var x = input[i] ^ msb;
        // Combine bits within x to further scramble the bits.
        x ^= (x >> 4); // XOR with its right-shifted value by 4 bits.

        // Compute the new MSB value:
        // - Start with the previous LSB value.
        // - XOR with x shifted right by 3 bits to bring in bits from lower positions.
        // - XOR with x shifted left by 4 bits to mix in higher-order bits.
        // - Finally, mask with 0xFF to ensure the result stays within 8 bits.
        msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
        // Compute the new LSB value:
        // - XOR x with x shifted left by 5 bits.
        // - Mask with 0xFF to maintain an 8-bit result.
        lsb = (x ^ (x << 5)) & 0xFF;
    }

    // Combine the two bytes into one 16-bit value.
    // The MSB is shifted left by 8 bits to occupy the high-order byte.
    // The LSB occupies the low-order byte.
    return (msb << 8) | lsb;
}

/**
 * Converts and optionally swaps FFLiMiiDataOfficial data to StoreData.
 * Adds a CRC-16/CCITT/XMODEM using {@link crc16}.
 * @param {Uint8Array} dst - Destination buffer for StoreData. Must be 96 bytes.
 * @param {Uint8Array} src - The source FFLiMiiDataOfficial data.
 * @param {boolean} swapEndian - Whether to swap the FFLiMiiDataOfficial data.
 */
function convOfficialToStore(dst, src, swapEndian) {
    dst.set(src);

    if (swapEndian) {
        swapFFLiMiiDataOfficial(dst);
    }

    var crc = crc16(dst, 94);
    var dv = new DataView(dst.buffer);
    dv.setUint16(94, crc, false);
}

/**
 * Convert a Uint8Array to a Base64 string.
 * @param {Uint8Array} bytes - The byte array to convert.
 * @returns {string} The Base64 encoded string.
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
 * @returns {string} The decoded UTF-16 name as a string.
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
 * @returns {boolean} True if all elements are zero, else false.
 */
function areAllZeros(arr) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== 0) {
            return false;
        }
    }
    return true;
}

/** @typedef {Array<{name: string, data: Uint8Array}|null>} StoreDataArray */

/**
 * Process the uploaded FFL_ODB.dat file and display valid Mii data.
 * @param {ArrayBuffer|null} arrayBuffer - The file data as ArrayBuffer.
 * @returns {StoreDataArray} An array of data from the FFL_ODB.
 * @throws {Error}
 */
function getStoreDataArrayFromDB(arrayBuffer) {
    if (!arrayBuffer) {
        throw new Error('getStoreDataArrayFromDB: arrayBuffer is null.');
    }
    var uint8Array = new Uint8Array(arrayBuffer);

    // Will change depending on CFL_ODB or not:
    var isLittleEndian;
    var totalMiis;

    // Verify the identifier, which is the first 4 bytes.
    var first4Bytes = uint8Array.subarray(0, 4);
    var magic = '';
    for (var i = 0; i < first4Bytes.length; i++) {
        magic += String.fromCharCode(first4Bytes[i]);
    }

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
        throw new Error('getStoreDataArrayFromDB: Invalid FFL_ODB.dat/CFL_DB.dat file magic. Expected FFOC/CFOG, actual magic: ' + magic);
    }

    // Calculate the total size expected for m_MiiDataOfficial
    var expectedSize = DATABASE_MIIDATA_OFFSET + (totalMiis * FFLI_MII_DATA_OFFICIAL_SIZE);
    if (uint8Array.length < expectedSize) {
        throw new Error('getStoreDataArrayFromDB: Unexpectedly large FFL_ODB.dat file size. Actual size: ' + uint8Array.length);
    }

    /** @type {StoreDataArray} */
    var storeDataArray = new Array(totalMiis);

    for (/* var */ i = 0; i < totalMiis; i++) {
        var offset = DATABASE_MIIDATA_OFFSET + (i * FFLI_MII_DATA_OFFICIAL_SIZE);
        var data = uint8Array.subarray(offset, offset + FFLI_MII_DATA_OFFICIAL_SIZE);

        // Extract CreateID (bytes 0xc - 0x15 within FFLiMiiDataOfficial)
        var createID = new Array(10);
        for (var j = 0; j < 10; j++) {
            createID[j] = data[12 + j];
        }

        // Perform endian swapping
        var storeData = new Uint8Array(96);
        convOfficialToStore(storeData, data, !isLittleEndian);

        // Check if the CreateID is all zeroes and ignore it if it is.
        if (areAllZeros(createID)) {
            storeDataArray[i] = null;
            continue;
        }

        // Decode UTF-16 name
        var name = decodeUTF16Name(storeData, NAME_OFFSET, MAX_NAME_LENGTH, true);

        // Extract roomIndex (4 bits) and positionInRoom (4 bits)
        // var roomIndex = (data[3] >> 4) & 0x0F; // Upper 4 bits of byte 3
        // var positionInRoom = data[3] & 0x0F;   // Lower 4 bits of byte 3

        // Add entry to the array as formatted text
        storeDataArray[i] = {
            name: name,
            // roomIndex: roomIndex,
            // positionInRoom: positionInRoom,
            data: storeData
        };
    }

    return storeDataArray;
}

/**
 * Display the list of valid Mii Base64 strings in the HTML.
 * @param {StoreDataArray} miis - Array of Mii objects containing name,
 * roomIndex, positionInRoom, and Base64 data.
 */
function displayStoreDataArray(miis) {
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
        var mii = miis[i];
        if (!mii) {
            continue;
        }

        var li = document.createElement('li');

        // Prefix with Name and Room Info
        li.textContent = mii.name + '\n'; // `${miis[i].name} (${miis[i].roomIndex}/${miis[i].positionInRoom}): `;

        // Encode data to Base64
        var base64Data = bytesToBase64(mii.data);
        // Add Base64 in a code block
        var codeBlock = document.createElement('code');
        codeBlock.textContent = base64Data;
        li.appendChild(codeBlock);

        // Add inner bullet with image
        var innerUl = document.createElement('ul');
        var innerLi = document.createElement('li');
        innerLi.innerHTML = '<img loading="lazy" src="https://mii-unsecure.ariankordi.net/miis/image.png?width=96&data=' + encodeURIComponent(base64Data) + '"><br>';
        innerUl.appendChild(innerLi);
        li.appendChild(innerUl);

        ul.appendChild(li);
    }

    // Inform the user if no valid Miis were found
    if (miis.length === 0) {
        li = document.createElement('li');
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

    reader.onload = function (e) {
        var arrayBuffer = /** @type {FileReader} */ (e.target).result;
        if (typeof arrayBuffer === 'string') {
            console.error('handleFileSelect / reader.onload: FileReader.result is string but ArrayBuffer was expected');
            return;
        }

        try {
            var array = getStoreDataArrayFromDB(arrayBuffer);
        } catch (e) {
            alert(e);
            throw e;
        }
        displayStoreDataArray(array);
    };

    reader.onerror = function () {
        alert('handleFileSelect / reader.onerror: Error reading file.');
    };

    // Read the file as ArrayBuffer for binary processing
    reader.readAsArrayBuffer(file);
}

// Uncomment the following block to use NWF's file reading implementation

/**
 * NWF File Reading Implementation
 * @param {Event & {data: Blob}} evt - The read event from NWF.
 */
function onFFLODBRead(evt) {
    // Check if evt.data is a Blob
    if (!evt.data) {
        alert('onFFLODBRead: evt.data is null or undefined.');
        return;
    }

    /** Define the Blob from the event. */
    var blob = evt.data;
    var reader = new FileReader();

    reader.onloadend = function () {
        if (!reader.result) {
            alert('onFFLODBRead: reader.result is null or undefined, failed to read Blob content.');
            return;
        }
        // Convert text content to an ArrayBuffer
        /** Result of the reader, which is expected to be a string. */
        var textData = reader.result;
        if (typeof textData !== 'string') {
            alert('onFFLODBRead / reader.onloadend: FileReader.result type is unexpectedly string');
            return;
        }
        var arrayBuffer = new Uint8Array(textData.split('').map(
            /**
             * @param {string} char - The character as a string.
             * @returns {number} The byte index of the character.
             */
            function (char) {
                return char.charCodeAt(0);
            })).buffer;

        // Process the ArrayBuffer
        try {
            var array = getStoreDataArrayFromDB(arrayBuffer);
        } catch (e) {
            alert(e);
            throw e;
        }
        displayStoreDataArray(array);
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
            /* eslint-disable @stylistic/indent-binary-ops -- False positives. */
            block = (str.charCodeAt(idx++) << 16) |
                (str.charCodeAt(idx++) << 8) |
                str.charCodeAt(idx++);
            output += chars.charAt((block >> 18) & 0x3F) +
                chars.charAt((block >> 12) & 0x3F) +
                chars.charAt((block >> 6) & 0x3F) +
                chars.charAt(block & 0x3F);
            /* eslint-enable @stylistic/indent-binary-ops -- False positives. */
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

// For reference, from FFL decomp (https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/FFLiDatabaseFileOfficial.h#L42)
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

// export { processFFLODB };
