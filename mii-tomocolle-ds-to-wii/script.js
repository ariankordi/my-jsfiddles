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
  * Handle the form submission.
  * @param {Event} event - The form submit event.
  */
function processData(event) {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const miiDataInput = document.getElementById('miiDataInput');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            const rawData = new Uint8Array(arrayBuffer);
            const paddedData = padTo74Bytes(rawData);
            processAndDisplaySwappedData(paddedData);
        };

        reader.onerror = function() {
            alert('Error reading file.');
        };

        reader.readAsArrayBuffer(file);
    } else if (miiDataInput.value.trim() !== '') {
        try {
            const decodedData = detectAndDecodeInput(miiDataInput.value);
            const paddedData = padTo74Bytes(decodedData);
            processAndDisplaySwappedData(paddedData);
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
 * Extract UTF-16 LE Mii name from data at the specified offset.
 * @param {Uint8Array} data - The data array containing the name.
 * @param {number} offset - The starting offset for the name.
 * @param {number} maxLength - The maximum length of the name in bytes.
 * @return {string} - The decoded name.
 */
function extractName(data, offset = 0x2, maxLength = 0x14) {
    let endPosition = offset;

    // Find the position of the null terminator (0x00 0x00)
    while (endPosition < offset + maxLength) {
        if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
            break;
        }
        endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
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
 * Perform endian swapping and display the result, including extracted name.
 * @param {Uint8Array} data - The input data to process.
 */
function processAndDisplaySwappedData(data) {
    const swappedData = new Uint8Array(data); // Create a copy
    swapEndian(swappedData, SWAP_ENDIAN_DESC_RFL);
    const hexString = bytesToHex(swappedData);

    // Extract the name from the data
    const extractedName = extractName(swappedData);

    // Append to the list with a random pastel background
    appendToList(hexString, extractedName);
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

    // Apply a random pastel color to the `li`
    li.style.color = getRandomPastelColor();

    ul.insertBefore(li, ul.firstChild);
}

/**
  * Initialize event listeners after DOM is loaded.
  */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('dataForm');
    form.addEventListener('submit', processData);
});

// Polyfill for atob if not available (optional)
if (!window.atob) {
    window.atob = function (input) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = input.replace(/=+$/, '');
        let output = '';

        if (str.length % 4 === 1) {
            throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
        }
        for (
            let bc = 0, bs = 0, buffer, i = 0;
            buffer = str.charAt(i++);
            ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
                        bc++ % 4) ?
            output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) :
            0
        ) {
            buffer = chars.indexOf(buffer);
        }
        return output;
    };
}
