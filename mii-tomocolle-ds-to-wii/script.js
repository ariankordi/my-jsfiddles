const DATA_LENGTH = 74; // sizeof(RFLCharData)
const NAME_OFFSET = 0x2; // name offset in RFLCharData
const MAX_NAME_LENGTH = 0x14; // 20 bytes/10 utf16 chars

// Constants for DeSmuME save state parsing
const DST_MAGIC_BYTES = new Uint8Array([0x44, 0x65, 0x53, 0x6D, 0x75, 0x4D, 0x45, 0x20]); // "DeSmuME SState"
const DST_ZLIB_OFFSET = 0x20; // Offset where zlib data starts
const DST_ZLIB_SIGNATURE = 0x78; // The first byte of zlib data

// Constants for endian swap types
const FFLI_SWAP_ENDIAN_TYPE_U8 = 0;
const FFLI_SWAP_ENDIAN_TYPE_U16 = 1;
const FFLI_SWAP_ENDIAN_TYPE_U32 = 2;

// Swap descriptor for RFL mii data
const SWAP_ENDIAN_DESC_RFL = [
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 11 },
    { type: FFLI_SWAP_ENDIAN_TYPE_U8,  count: 10 },
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 11 },
    { type: FFLI_SWAP_ENDIAN_TYPE_U16, count: 10 } // creator name
];

/**
  * Swap the endianness of an array of integers based on the descriptor.
  * @param {Uint8Array} data - The byte array to swap.
  * @param {Array} swapDesc - The swap descriptor array.
  */
function swapEndian(data, swapDesc) {
    let offset = 0;
    for (let desc of swapDesc) {
        swapEndianArray(data, offset, desc.count, desc.type);
        offset += desc.count * (desc.type === FFLI_SWAP_ENDIAN_TYPE_U8 ? 1 :
                                desc.type === FFLI_SWAP_ENDIAN_TYPE_U16 ? 2 :
                                4);
    }
}

/**
  * Swap the endianness of an array of integers.
  * @param {Uint8Array} data - The byte array to swap.
  * @param {number} start - The starting offset in the array.
  * @param {number} count - The number of elements to swap.
  * @param {number} type - The type of elements (U8, U16, or U32).
  */
function swapEndianArray(data, start, count, type) {
    const size = type === FFLI_SWAP_ENDIAN_TYPE_U8 ? 1 :
    type === FFLI_SWAP_ENDIAN_TYPE_U16 ? 2 :
    4; // U32

    for (let i = 0; i < count; i++) {
        const index = start + (i * size);
        if (type === FFLI_SWAP_ENDIAN_TYPE_U16) {
            // Swap two bytes
            const temp = data[index];
            data[index] = data[index + 1];
            data[index + 1] = temp;
        } else if (type === FFLI_SWAP_ENDIAN_TYPE_U32) {
            // Swap four bytes
            const temp0 = data[index];
            const temp1 = data[index + 1];
            data[index] = data[index + 3];
            data[index + 1] = data[index + 2];
            data[index + 2] = temp1;
            data[index + 3] = temp0;
        }
        // U8 requires no swapping
    }
}

/**
  * Convert a Uint8Array to a Hex string.
  * @param {Uint8Array} bytes - The byte array to convert.
  * @return {string} - The Hex encoded string.
  */
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('').toUpperCase();
}

/**
  * Function to detect if the string is Base64 or Hex and decode it.
  * @param {string} input - The input string to detect and decode.
  * @return {Uint8Array} - The decoded byte array.
  */
function detectAndDecodeInput(input) {
    input = input.replace(/\s+/g, '');

    // Check if it looks like a hex string (only contains valid hex characters)
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (hexRegex.test(input)) {
        if (input.length % 2 !== 0) {
            throw new Error("Invalid Hex input length. Must be even number of characters.");
        }
        const hexArray = input.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        return new Uint8Array(hexArray);
    }

    // Otherwise, assume it's Base64
    try {
        const binaryString = atob(input);
        return Uint8Array.from(binaryString, c => c.charCodeAt(0));
    } catch (e) {
        throw new Error("Invalid input: not a valid Base64 or Hex string.");
    }
}

/**
  * Pad or trim the data to 74 bytes.
  * @param {Uint8Array} data - The input data.
  * @return {Uint8Array} - The padded or trimmed data.
  */
function padTo74Bytes(data) {
    if (data.length === 74) {
        return data;
    } else if (data.length < 74) {
        const padded = new Uint8Array(74);
        padded.set(data);
        return padded;
    } else {
        return data.slice(0, 74);
    }
}

/**
 * Check if the file is a compressed DeSmuME save state.
 * @param {Uint8Array} data - The file data.
 * @return {boolean} - True if the file is compressed, false otherwise.
 */
function isCompressedDeSmuMESave(data) {
    // Check for the magic bytes at the start of the file
    for (let i = 0; i < DST_MAGIC_BYTES.length; i++) {
        if (data[i] !== DST_MAGIC_BYTES[i]) {
            return false;
        }
    }

    // Check for the zlib signature at the specified offset
    return data[DST_ZLIB_OFFSET] === DST_ZLIB_SIGNATURE;
}

/**
 * Decompress zlib-compressed data using CompressionStream.
 * @param {Uint8Array} data - The compressed data.
 * @return {Promise<Uint8Array>} - The decompressed data as a Uint8Array.
 */
async function decompressDSTZlib(data) {
    if (!window.CompressionStream) {
        throw new Error('CompressionStream is not supported in this browser.');
    }

    const compressed = data.slice(DST_ZLIB_OFFSET); // Extract the zlib-compressed part
    const cs = new DecompressionStream('deflate');
    const stream = new Response(compressed).body.pipeThrough(cs);
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
}


/**
  * Handle the form submission.
  * @param {Event} event - The form submit event.
  */
async function processData(event) {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const miiDataInput = document.getElementById('miiDataInput');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async function (e) {
            const arrayBuffer = e.target.result;
            let rawData = new Uint8Array(arrayBuffer);
            // Check for compression
            if (isCompressedDeSmuMESave(rawData)) {
                rawData = await decompressDSTZlib(rawData);
            }


            // If the data length exceeds 74 bytes, treat it as a database
            if (rawData.length > DATA_LENGTH) {
                processSave(rawData.buffer);
            } else {
                // Otherwise, process as a single Mii
                const paddedData = padTo74Bytes(rawData);
                processAndDisplaySwappedData([paddedData]);
            }
        };

        reader.onerror = function () {
            alert('Error reading file.');
        };

        reader.readAsArrayBuffer(file);
    } else if (miiDataInput.value.trim() !== '') {
        try {
            const decodedData = detectAndDecodeInput(miiDataInput.value);

            const paddedData = padTo74Bytes(decodedData);
            processAndDisplaySwappedData([paddedData]);
        } catch (error) {
            alert(error.message);
            return;
        }
    } else {
        alert("Please provide a file or Hex/Base64 Mii data.");
        return;
    }

    // Clear the input fields
    fileInput.value = '';
    miiDataInput.value = '';
}

/**
 * Extract UTF-16 BE Mii name from data at the specified offset.
 * @param {Uint8Array} data - The data array containing the name.
 * @param {number} offset - The starting offset for the name.
 * @param {number} maxLength - The maximum length of the name in bytes.
 * @return {string} - The decoded name.
 */
function extractName(data, offset = NAME_OFFSET, maxLength = MAX_NAME_LENGTH) {
    let endPosition = offset;

    // Find the position of the null terminator (0x00 0x00)
    while (endPosition < offset + maxLength) {
        if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
            break;
        }
        endPosition += 2; // Move in 2-byte increments (UTF-16 BE)
    }

    // Extract and decode the name
    const nameBytes = data.slice(offset, endPosition);
    return new TextDecoder('utf-16be').decode(nameBytes);
}

/**
 * Generate a random pastel color.
 * @return {string} - The generated RGB color string.
 */
function getRandomPastelColor() {
    const mix = [255, 255, 224]; // Light yellow helps in making pastel colors
    const base = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
    const pastel = base.map((val, index) => Math.round((val + mix[index]) / 2));
    return `rgb(${pastel.join(', ')})`;
}

/**
 * Perform endian swapping and display the results for multiple Miis.
 * @param {Uint8Array[]} miiDataBlocks - Array of Mii data blocks to process.
 */
function processAndDisplaySwappedData(miiDataBlocks) {
    const ul = document.getElementById('outputList');
    //ul.innerHTML = ''; // Clear previous results

    miiDataBlocks.forEach(block => {
        const swappedData = new Uint8Array(block); // Create a copy
        swapEndian(swappedData, SWAP_ENDIAN_DESC_RFL);
        const hexString = bytesToHex(swappedData);

        // Extract the name from the data
        const extractedName = extractName(swappedData);

        // Append to the list with formatted display
        appendToList(hexString, extractedName);
    });

    // Inform the user if no valid Miis were found
    if (miiDataBlocks.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No valid Mii data found.';
        if (ul.firstChild) {
            ul.insertBefore(li, ul.firstChild);
        } else {
            ul.appendChild(li);
        }
    }
}

/**
 * Append the swapped Hex data and name to the top of the list.
 * @param {string} hexData - The Hex string to append.
 * @param {string} name - The extracted name.
 */
function appendToList(hexData, name) {
    const ul = document.getElementById('outputList');
    const li = document.createElement('li');
    const pre = document.createElement('pre');

    // Add the name and Hex data
    pre.textContent = hexData;
    li.textContent = name;
    li.appendChild(pre);

    // Add inner bullet with image
    const innerUl = document.createElement('ul');
    const innerLi = document.createElement('li');
    innerLi.innerHTML = `<img loading="lazy" src="https://mii-unsecure.ariankordi.net/miis/image.png?width=96&data=${encodeURIComponent(hexData)}"><br>`;
    innerUl.appendChild(innerLi);
    li.appendChild(innerUl);

    // Apply a random pastel color to the `li`
    li.style.color = getRandomPastelColor();

    ul.insertBefore(li, ul.firstChild);
}

/**
 * Check if a Mii block is valid.
 * @param {Uint8Array} block - The Mii data block to validate.
 * @return {boolean} - True if the block is valid, false otherwise.
 */
function isValidMiiBlock(block) {
    // Hex sequence for ASCII string "tsumanogosakata"
    // This is a string that is right after our
    // desired "MaaMiiMuuMeeMoo" in the game ROM.
    // This is checked against in case someone
    // passes in a save state containing the game code
    // and it mistakenly finds the string IN THE CODE
    // and treats the string defined after that as
    // actual data and jumpscares them nononono
    const invalidPrefix = [0x74, 0x73, 0x75, 0x6D, 0x61, 0x6E, 0x6F, 0x67, 0x6F, 0x73, 0x61, 0x6B, 0x61, 0x74, 0x61];

    // Check if the block is all zeros
    if (areAllZeros(block)) {
        return false;
    }

    // Check if the block starts with "tsumanogosakata" and invalidate it
    let matchesInvalidPrefix = true;
    for (let i = 0; i < invalidPrefix.length; i++) {
        if (block[i] !== invalidPrefix[i]) {
            matchesInvalidPrefix = false;
            break;
        }
    }
    if (matchesInvalidPrefix) {
    	return false;
    }

    return true; // Passed all checks
}


/**
 * Search the data for the signature sequence and extract RFL data blocks.
 * @param {Uint8Array} data - The entire file data.
 * @return {Uint8Array[]} - Array of extracted RFL data blocks.
 */
function extractMiiDataBlocks(data) {
    const signature = [0x4D, 0x61, 0x61, 0x4D, 0x69, 0x69, 0x4D, 0x75, 0x75, 0x4D, 0x65, 0x65, 0x4D, 0x6F, 0x6F, 0x00];
    const signatureLength = signature.length;
    const miiDataLength = 74;
    const miiDataBlocks = [];

    for (let i = 0; i <= data.length - signatureLength - miiDataLength; i++) {
        // Check for the signature sequence
        let match = true;
        for (let j = 0; j < signatureLength; j++) {
            if (data[i + j] !== signature[j]) {
                match = false;
                break;
            }
        }

        if (match) {
            const miiStart = i + signatureLength;
            const miiEnd = miiStart + miiDataLength;
            const miiBlock = data.slice(miiStart, miiEnd);

            // Validate the Mii block
            if (isValidMiiBlock(miiBlock)) {
                miiDataBlocks.push(miiBlock);
            }

            // Move the index past this Mii block to avoid overlapping matches
            i = miiEnd - 1;
        }
    }

    return miiDataBlocks;
}

/**
 * Deduplicate an array of Uint8Array based on their hex representation.
 * @param {Uint8Array[]} miiDataBlocks - Array of Mii data blocks.
 * @return {Uint8Array[]} - Deduplicated array of Mii data blocks.
 */
function deduplicateMiis(miiDataBlocks) {
    const seen = new Set();
    const uniqueMiis = [];

    miiDataBlocks.forEach(block => {
        const hex = bytesToHex(block);
        if (!seen.has(hex)) {
            seen.add(hex);
            uniqueMiis.push(block);
        }
    });

    return uniqueMiis;
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
 * Process the save file and display valid Mii data.
 * @param {ArrayBuffer} arrayBuffer - The file data as ArrayBuffer.
 */
function processSave(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);

    // Search for signature and extract Mii data blocks
    let miiDataBlocks = extractMiiDataBlocks(uint8Array);

    // Deduplicate the Mii data blocks
    miiDataBlocks = deduplicateMiis(miiDataBlocks);

    // Process and display the deduplicated Mii data
    processAndDisplaySwappedData(miiDataBlocks);
}


/**
  * Initialize event listeners after DOM is loaded.
  */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('dataForm');
    form.addEventListener('submit', processData);
 
    const fileInput = document.getElementById('fileInput');

    fileInput.addEventListener('change', function () {
        processData(new Event('submit')); // Call the existing function
    });
});