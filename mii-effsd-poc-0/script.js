// === Mapping Tables ===

// Mapping tables from Ver4 to Ver3
 const ToVer3HairColorTable = [
    0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 3, 5, 4, 4, 6, 2, 0, 6, 4, 3,
    2, 2, 7, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    2, 4, 4, 4, 4, 4, 4, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4,
    4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 5, 7, 5, 7, 7,
    7, 7, 7, 6, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 0, 4, 4, 4, 4
];

const ToVer3EyeColorTable = [
    0, 2, 2, 2, 1, 3, 2, 3, 0, 1, 2, 3, 4, 5, 2, 2, 4, 2, 1, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0,
    4, 4, 4, 4, 4, 4, 4, 1, 0, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3,
    3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1
];

const ToVer3MouthColorTable = [
    4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 1, 4, 4, 4, 0,
    1, 2, 3, 4, 4, 2, 3, 3, 4, 4, 4, 4, 1, 4, 4, 2, 3, 3, 4, 4,
    4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4, 4,
    4, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3,
    3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4, 3, 3, 3, 3
];

const ToVer3GlassColorTable = [
    0, 1, 1, 1, 5, 1, 1, 4, 0, 5, 1, 1, 3, 5, 1, 2, 3, 4, 5, 4,
    2, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5,
    5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5
];

const ToVer3FacelineColorTable = [0, 1, 2, 3, 4, 5, 0, 1, 5, 5];

const ToVer3GlassTypeTable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 1, 3, 7, 7, 6, 7, 8, 7, 7];

// === Reverse Mapping Tables ===

// Helper function to create reverse mapping tables
function createReverseMapping(table) {
    const reverseMap = {};
    table.forEach((ver3Value, ver4Index) => {
        if (!reverseMap[ver3Value]) {
            reverseMap[ver3Value] = [];
        }
        reverseMap[ver3Value].push(ver4Index);
    });
    return reverseMap;
}

// Create reverse mappings
const hairColorReverseMap = createReverseMapping(ToVer3HairColorTable);
const eyeColorReverseMap = createReverseMapping(ToVer3EyeColorTable);
const mouthColorReverseMap = createReverseMapping(ToVer3MouthColorTable);
const glassColorReverseMap = createReverseMapping(ToVer3GlassColorTable);
const faceColorReverseMap = createReverseMapping(ToVer3FacelineColorTable);
const glassTypeReverseMap = createReverseMapping(ToVer3GlassTypeTable);

// === Utility Functions ===

// Convert hex string to byte array
function hexToBytes(hex) {
    hex = hex.replace(/\s+/g, ''); // Remove any whitespace
    if (hex.length % 2 !== 0) {
        throw new Error('Invalid hex string length.');
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        const byte = hex.substr(i * 2, 2);
        bytes[i] = parseInt(byte, 16);
    }
    return bytes;
}

// Convert byte array to hex string
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// Get group index from reverse mapping
function getGroupIndex(reverseMap, ver3Value, ver4Value) {
    const group = reverseMap[ver3Value];
    if (!group) {
        throw new Error(`No reverse mapping found for Ver3 value ${ver3Value}`);
    }
    const index = group.indexOf(ver4Value);
    if (index === -1) {
        throw new Error(`Ver4 value ${ver4Value} not found in Ver3 group ${ver3Value}`);
    }
    return index;
}

// Reconstruct Ver4 value from group index
function reconstructVer4Value(reverseMap, ver3Value, groupIndex) {
    const group = reverseMap[ver3Value];
    if (!group) {
        throw new Error(`No reverse mapping found for Ver3 value ${ver3Value}`);
    }
    if (groupIndex < 0 || groupIndex >= group.length) {
        throw new Error(`Invalid group index ${groupIndex} for Ver3 value ${ver3Value}`);
    }
    return group[groupIndex];
}

// === Padding Bit Manipulation ===

// Write padding bits into core data as per mapping
function writePadding(coreData, bits) {
    // Ensure bits is a BigInt
    if (typeof bits !== 'bigint') {
        bits = BigInt(bits);
    }

/*
    // Write bits into specific byte positions
    // bits: 0-40 (41 bits)
    // Mapping as per C code's write_padding function
    coreData[1] = (coreData[1] & 0x3F) | Number((bits & 0x3n) << 6n);
    coreData[3] = (coreData[3] & 0x7F) | Number(((bits >> 2n) & 0x1n) << 7n);
    coreData[0x16] = Number((bits >> 3n) & 0xFFn);
    coreData[0x17] = Number((bits >> 11n) & 0xFFn);
    coreData[0x19] = (coreData[0x19] & 0x7F) | Number(((bits >> 19n) & 0x1n) << 7n);
    coreData[0x33] = (coreData[0x33] & 0xF8) | Number(((bits >> 20n) & 0xFn));
    coreData[0x37] = (coreData[0x37] & 0x3F) | Number(((bits >> 24n) & 0x3n) << 6n);
    coreData[0x39] = (coreData[0x39] & 0x7F) | Number(((bits >> 26n) & 0x1n) << 7n);
    coreData[0x3B] = (coreData[0x3B] & 0x3F) | Number(((bits >> 27n) & 0x3n) << 6n);
    coreData[0x3D] = (coreData[0x3D] & 0x3F) | Number(((bits >> 29n) & 0x3n) << 6n);
    coreData[0x41] = Number((bits >> 31n) & 0xFFn);
    coreData[0x43] = (coreData[0x43] & 0x7F) | Number(((bits >> 39n) & 0x1n) << 7n);
    coreData[0x47] = (coreData[0x47] & 0x7F) | Number(((bits >> 40n) & 0x1n) << 7n);
    coreData[3] = (coreData[3] & 0xF0) | Number(((bits >> 41n) & 0xFn));
    */
    // Ensure 'bits' is a BigInt for consistency
    let mask;

    // Write each part of the padding into the respective bits in the core data
    mask = (1n << 2n) - 1n; // 2 bits
    coreData[1] = (coreData[1] & 0x3F) | Number((bits & mask) << 6n);
    bits >>= 2n;

    mask = (1n << 1n) - 1n; // 1 bit
    coreData[3] = (coreData[3] & 0x7F) | Number((bits & mask) << 7n);
    bits >>= 1n;

    mask = (1n << 8n) - 1n; // 8 bits
    coreData[0x16] = Number(bits & mask);
    bits >>= 8n;

    coreData[0x17] = Number(bits & mask);
    bits >>= 8n;

    mask = (1n << 1n) - 1n; // 1 bit
    coreData[0x19] = (coreData[0x19] & 0x7F) | Number((bits & mask) << 7n);
    bits >>= 1n;

    mask = (1n << 4n) - 1n; // 4 bits
    coreData[0x33] = (coreData[0x33] & 0xF) | Number((bits & mask) << 4n);
    bits >>= 4n;

    mask = (1n << 2n) - 1n; // 2 bits
    coreData[0x37] = (coreData[0x37] & 0x3F) | Number((bits & mask) << 6n);
    bits >>= 2n;

    mask = (1n << 1n) - 1n; // 1 bit
    coreData[0x39] = (coreData[0x39] & 0x7F) | Number((bits & mask) << 7n);
    bits >>= 1n;

    mask = (1n << 2n) - 1n; // 2 bits
    coreData[0x3B] = (coreData[0x3B] & 0x3F) | Number((bits & mask) << 6n);
    bits >>= 2n;

    coreData[0x3D] = (coreData[0x3D] & 0x3F) | Number((bits & mask) << 6n);
    bits >>= 2n;

    mask = (1n << 8n) - 1n; // 8 bits
    coreData[0x41] = Number(bits & mask);
    bits >>= 8n;

    mask = (1n << 1n) - 1n; // 1 bit
    coreData[0x43] = (coreData[0x43] & 0x7F) | Number((bits & mask) << 7n);
    bits >>= 1n;

    coreData[0x47] = (coreData[0x47] & 0x7F) | Number((bits & mask) << 7n);
    bits >>= 1n;

    mask = (1n << 4n) - 1n; // 4 bits
    coreData[3] = (coreData[3] & 0xF0) | Number(bits & mask);

}

// Extract padding bits from core data as per mapping
function extractPadding(coreData) {
    let bits = 0n;

    bits |= BigInt(coreData[1] >> 6 & 0x3) << 0n;
    bits |= BigInt(coreData[3] >> 7 & 0x1) << 2n;
    bits |= BigInt(coreData[0x16]) << 3n;
    bits |= BigInt(coreData[0x17]) << 11n;
    bits |= BigInt(coreData[0x19] >> 7 & 0x1) << 19n;
    bits |= BigInt(coreData[0x33] >> 4 & 0xF) << 20n;
    bits |= BigInt(coreData[0x37] >> 6 & 0x3) << 24n;
    bits |= BigInt(coreData[0x39] >> 7 & 0x1) << 26n;
    bits |= BigInt(coreData[0x3B] >> 6 & 0x3) << 27n;
    bits |= BigInt(coreData[0x3D] >> 6 & 0x3) << 29n;
    bits |= BigInt(coreData[0x41]) << 31n;
    bits |= BigInt(coreData[0x43] >> 7 & 0x1) << 39n;
    bits |= BigInt(coreData[0x47] >> 7 & 0x1) << 40n;
    bits |= BigInt(coreData[3] & 0xF) << 41n;

    return bits;
}


// === Group Indices Packing and Unpacking ===

// Pack group indices into 41-bit integer
function packGroupIndices(indices) {
    let bits = 0n;

    bits |= BigInt(indices.faceColorGroupIndex & 0x3);          // 2 bits
    bits |= BigInt(indices.hairColorGroupIndex & 0x3F) << 2n;   // 6 bits
    bits |= BigInt(indices.eyeColorGroupIndex & 0x3F) << 8n;    // 6 bits
    bits |= BigInt(indices.eyebrowColorGroupIndex & 0x3F) << 14n; // 6 bits
    bits |= BigInt(indices.mouthColorGroupIndex & 0x3F) << 20n;    // 6 bits
    bits |= BigInt(indices.beardColorGroupIndex & 0x3F) << 26n;    // 6 bits
    bits |= BigInt(indices.glassColorGroupIndex & 0x3F) << 32n;    // 6 bits
    bits |= BigInt(indices.glassTypeGroupIndex & 0x7) << 38n;      // 3 bits

    return bits;
}

// Unpack group indices from 41-bit integer
function unpackGroupIndices(bits) {
    const indices = {};

    indices.faceColorGroupIndex = Number((bits >> 0n) & 0x3n);             // 2 bits
    indices.hairColorGroupIndex = Number((bits >> 2n) & 0x3Fn);          // 6 bits
    indices.eyeColorGroupIndex = Number((bits >> 8n) & 0x3Fn);           // 6 bits
    indices.eyebrowColorGroupIndex = Number((bits >> 14n) & 0x3Fn);      // 6 bits
    indices.mouthColorGroupIndex = Number((bits >> 20n) & 0x3Fn);        // 6 bits
    indices.beardColorGroupIndex = Number((bits >> 26n) & 0x3Fn);        // 6 bits
    indices.glassColorGroupIndex = Number((bits >> 32n) & 0x3Fn);        // 6 bits
    indices.glassTypeGroupIndex = Number((bits >> 38n) & 0x7n);          // 3 bits

    return indices;
}

// === Common Colors Packing and Unpacking ===

// Pack common colors into core data's padding bits
function packCommonColors(coreData, commonColors) {
    // Log current Ver3 indices from core data
    console.log("Current Ver3 indices in core data:");
    console.log("Face Color Ver3:", (coreData[0x30] >> 5) & 0x7);
    console.log("Hair Color Ver3:", coreData[0x33] & 0x7);
    console.log("Eye Color Ver3:", ((coreData[0x35] & 0x1) << 2) | (coreData[0x34] >> 6));
    console.log("Eyebrow Color Ver3:", (coreData[0x38] >> 5) & 0x7);
    console.log("Mouth Color Ver3:", ((coreData[0x3F] & 0x1) << 2) | (coreData[0x3E] >> 6));
    console.log("Beard Color Ver3:", (coreData[0x42] >> 3) & 0x7);
    console.log("Glass Color Ver3:", (coreData[0x44] >> 4) & 0x7);
    console.log("Glass Type Ver3:", coreData[0x44] & 0xF);

    // Map Ver4 indices to Ver3 indices
    const faceColorVer3 = ToVer3FacelineColorTable[commonColors.faceColor];
    const hairColorVer3 = ToVer3HairColorTable[commonColors.hairColor];
    const eyeColorVer3 = ToVer3EyeColorTable[commonColors.eyeColor];
    const eyebrowColorVer3 = ToVer3HairColorTable[commonColors.eyebrowColor];
    const mouthColorVer3 = ToVer3MouthColorTable[commonColors.mouthColor];
    const beardColorVer3 = ToVer3HairColorTable[commonColors.beardColor];
    const glassColorVer3 = ToVer3GlassColorTable[commonColors.glassColor];
    const glassTypeVer3 = ToVer3GlassTypeTable[commonColors.glassType];

    // Log the Ver3 indices being set
    console.log("\nNew Ver3 indices to set into core data:");
    console.log("Face Color Ver3:", faceColorVer3);
    console.log("Hair Color Ver3:", hairColorVer3);
    console.log("Eye Color Ver3:", eyeColorVer3);
    console.log("Eyebrow Color Ver3:", eyebrowColorVer3);
    console.log("Mouth Color Ver3:", mouthColorVer3);
    console.log("Beard Color Ver3:", beardColorVer3);
    console.log("Glass Color Ver3:", glassColorVer3);
    console.log("Glass Type Ver3:", glassTypeVer3);

    // Set Ver3 indices into core data
    coreData[0x30] = (coreData[0x30] & 0x1F) | ((faceColorVer3 & 0x7) << 5);
    coreData[0x33] = (coreData[0x33] & 0xF8) | (hairColorVer3 & 0x7);

    let eyeColorBits = eyeColorVer3 & 0x7;
    coreData[0x34] = (coreData[0x34] & 0x3F) | ((eyeColorBits & 0x3) << 6);
    coreData[0x35] = (coreData[0x35] & 0xFE) | ((eyeColorBits >> 2) & 0x1);

    coreData[0x38] = (coreData[0x38] & 0x1F) | ((eyebrowColorVer3 & 0x7) << 5);

    let mouthColorBits = mouthColorVer3 & 0x7;
    coreData[0x3E] = (coreData[0x3E] & 0x3F) | ((mouthColorBits & 0x3) << 6);
    coreData[0x3F] = (coreData[0x3F] & 0xFE) | ((mouthColorBits >> 2) & 0x1);

    coreData[0x42] = (coreData[0x42] & 0xC7) | ((beardColorVer3 & 0x7) << 3);

    coreData[0x44] = (coreData[0x44] & 0x8F) | ((glassColorVer3 & 0x7) << 4);
    coreData[0x44] = (coreData[0x44] & 0xF0) | (glassTypeVer3 & 0xF);

    // Get group indices using reverse mappings
    const faceColorGroupIndex = getGroupIndex(faceColorReverseMap, faceColorVer3, commonColors.faceColor);
    const hairColorGroupIndex = getGroupIndex(hairColorReverseMap, hairColorVer3, commonColors.hairColor);
    const eyeColorGroupIndex = getGroupIndex(eyeColorReverseMap, eyeColorVer3, commonColors.eyeColor);
    const eyebrowColorGroupIndex = getGroupIndex(hairColorReverseMap, eyebrowColorVer3, commonColors.eyebrowColor);
    const mouthColorGroupIndex = getGroupIndex(mouthColorReverseMap, mouthColorVer3, commonColors.mouthColor);
    const beardColorGroupIndex = getGroupIndex(hairColorReverseMap, beardColorVer3, commonColors.beardColor);
    const glassColorGroupIndex = getGroupIndex(glassColorReverseMap, glassColorVer3, commonColors.glassColor);
    const glassTypeGroupIndex = getGroupIndex(glassTypeReverseMap, glassTypeVer3, commonColors.glassType);

    // Create indices object
    const indices = {
        faceColorGroupIndex,
        hairColorGroupIndex,
        eyeColorGroupIndex,
        eyebrowColorGroupIndex,
        mouthColorGroupIndex,
        beardColorGroupIndex,
        glassColorGroupIndex,
        glassTypeGroupIndex
    };

    // Pack group indices into bits
    const packedBits = packGroupIndices(indices);

    // Write padding bits into core data
    writePadding(coreData, packedBits);

    return {
        ver3Indices: {
            faceColorVer3,
            hairColorVer3,
            eyeColorVer3,
            eyebrowColorVer3,
            mouthColorVer3,
            beardColorVer3,
            glassColorVer3,
            glassTypeVer3
        },
        groupIndices: indices,
        paddingHex: bytesToHex(packedBitsToBytes(packedBits)),
        encodedCoreDataHex: bytesToHex(coreData)
    };
}

// Convert BigInt bits to byte array (6 bytes for 41 bits)
function packedBitsToBytes(bits) {
    const bytes = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
        bytes[i] = Number((bits >> (BigInt(i) * 8n)) & 0xFFn);
    }
    return bytes;
}

// Unpack common colors from core data's padding bits
function unpackCommonColors(coreData) {
    // Extract padding bits from core data
    const bits = extractPadding(coreData);

    // Unpack group indices from bits
    const indices = unpackGroupIndices(bits);

    // Extract Ver3 indices from core data
    const faceColorVer3 = (coreData[0x30] >> 5) & 0x7; // 3 bits
    const hairColorVer3 = coreData[0x33] & 0x7;        // 3 bits
    const eyeColorVer3 = ((coreData[0x35] & 0x1) << 2) | (coreData[0x34] >> 6); // 3 bits
    const eyebrowColorVer3 = (coreData[0x38] >> 5) & 0x7; // 3 bits
    const mouthColorVer3 = ((coreData[0x3F] & 0x1) << 2) | (coreData[0x3E] >> 6); // 3 bits
    const beardColorVer3 = (coreData[0x42] >> 3) & 0x7; // 3 bits
    const glassColorVer3 = (coreData[0x44] >> 4) & 0x7; // 3 bits
    const glassTypeVer3 = coreData[0x44] & 0xF;         // 4 bits

    // Log Ver3 indices from core data
    console.log("Extracted Ver3 indices from core data:");
    console.log("Face Color Ver3:", faceColorVer3);
    console.log("Hair Color Ver3:", hairColorVer3);
    console.log("Eye Color Ver3:", eyeColorVer3);
    console.log("Eyebrow Color Ver3:", eyebrowColorVer3);
    console.log("Mouth Color Ver3:", mouthColorVer3);
    console.log("Beard Color Ver3:", beardColorVer3);
    console.log("Glass Color Ver3:", glassColorVer3);
    console.log("Glass Type Ver3:", glassTypeVer3);

    // Reconstruct Ver4 common colors using reverse mappings
    const commonColors = {
        faceColor: reconstructVer4Value(faceColorReverseMap, faceColorVer3, indices.faceColorGroupIndex),
        hairColor: reconstructVer4Value(hairColorReverseMap, hairColorVer3, indices.hairColorGroupIndex),
        eyeColor: reconstructVer4Value(eyeColorReverseMap, eyeColorVer3, indices.eyeColorGroupIndex),
        eyebrowColor: reconstructVer4Value(hairColorReverseMap, eyebrowColorVer3, indices.eyebrowColorGroupIndex),
        mouthColor: reconstructVer4Value(mouthColorReverseMap, mouthColorVer3, indices.mouthColorGroupIndex),
        beardColor: reconstructVer4Value(hairColorReverseMap, beardColorVer3, indices.beardColorGroupIndex),
        glassColor: reconstructVer4Value(glassColorReverseMap, glassColorVer3, indices.glassColorGroupIndex),
        glassType: reconstructVer4Value(glassTypeReverseMap, glassTypeVer3, indices.glassTypeGroupIndex)
    };

    return {
        ver4Colors: commonColors,
        groupIndices: indices
    };
}


// === Form 1: Encode Padding Data into Core Data ===

document.getElementById('encodePaddingForm').addEventListener('submit', function(e) {
    e.preventDefault();

    try {
        // Get input values
        const coreDataHex = document.getElementById('encodeCoreData').value.trim();
        const paddingHex = document.getElementById('encodePaddingHex').value.trim();

        // Convert hex to byte arrays
        let coreData = hexToBytes(coreDataHex);
        let paddingData = hexToBytes(paddingHex);

        // Ensure coreData is 72 bytes
        if (coreData.length < 72) {
            const paddedCoreData = new Uint8Array(72);
            paddedCoreData.set(coreData, 0);
            coreData = paddedCoreData;
        } else if (coreData.length > 72) {
            coreData = coreData.slice(0, 72);
        }

        // Ensure paddingData is 6 bytes
        if (paddingData.length < 6) {
            const paddedPadding = new Uint8Array(6);
            paddedPadding.set(paddingData, 0);
            paddingData = paddedPadding;
        } else if (paddingData.length > 6) {
            paddingData = paddingData.slice(0, 6);
        }

        // Convert padding bytes to BigInt
        let bits = 0n;
        for (let i = 0; i < 6; i++) {
            bits |= BigInt(paddingData[i]) << (BigInt(i) * 8n);
        }

        // Mask to ensure only 41 bits are used
        bits &= 0x1FFFFFFFFFFn;

        // Write padding bits into core data
        writePadding(coreData, bits);

        // Convert core data back to hex
        const encodedCoreDataHex = bytesToHex(coreData);

        // Display the result
        document.getElementById('encodedCoreDataHexOutput').textContent = encodedCoreDataHex;
        
        // Optionally, fill the decoder's input field if it exists
        document.getElementById('decodeCoreData').value = encodedCoreDataHex;

    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// === Form 2: Decode Padding Data from Core Data ===

document.getElementById('decodePaddingForm').addEventListener('submit', function(e) {
    e.preventDefault();

    try {
        // Get input value
        const coreDataHex = document.getElementById('decodeCoreData').value.trim();

        // Convert hex to byte array
        let coreData = hexToBytes(coreDataHex);

        // Ensure coreData is 72 bytes
        if (coreData.length < 72) {
            const paddedCoreData = new Uint8Array(72);
            paddedCoreData.set(coreData, 0);
            coreData = paddedCoreData;
        } else if (coreData.length > 72) {
            coreData = coreData.slice(0, 72);
        }

        // Extract padding bits
        const bits = extractPadding(coreData);

        // Convert bits to bytes (6 bytes, first 41 bits used)
        const paddingBytes = packedBitsToBytes(bits);

        // Convert to hex
        const paddingHex = bytesToHex(paddingBytes);

        // Display the result
        document.getElementById('extractedPaddingHexOutput').textContent = paddingHex;
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// === Form 3: Pack Common Colors into Core Data ===

document.getElementById('packCommonColorsForm').addEventListener('submit', function(e) {
    e.preventDefault();

    try {
        // Get core data hex
        const coreDataHex = document.getElementById('packCoreData').value.trim();

        // Convert hex to byte array
        let coreData = hexToBytes(coreDataHex);

        // Ensure coreData is 72 bytes
        if (coreData.length < 72) {
            const paddedCoreData = new Uint8Array(72);
            paddedCoreData.set(coreData, 0);
            coreData = paddedCoreData;
        } else if (coreData.length > 72) {
            coreData = coreData.slice(0, 72);
        }

        // Get common colors inputs
        const commonColors = {
            faceColor: parseInt(document.getElementById('packFaceColor').value),
            hairColor: parseInt(document.getElementById('packHairColor').value),
            eyeColor: parseInt(document.getElementById('packEyeColor').value),
            eyebrowColor: parseInt(document.getElementById('packEyebrowColor').value),
            mouthColor: parseInt(document.getElementById('packMouthColor').value),
            beardColor: parseInt(document.getElementById('packBeardColor').value),
            glassColor: parseInt(document.getElementById('packGlassColor').value),
            glassType: parseInt(document.getElementById('packGlassType').value)
        };

        // Validate input ranges
        if (commonColors.faceColor < 0 || commonColors.faceColor > 9) {
            throw new Error('Face Color out of range (0-9).');
        }
        if (commonColors.hairColor < 0 || commonColors.hairColor > 99) {
            throw new Error('Hair Color out of range (0-99).');
        }
        if (commonColors.eyeColor < 0 || commonColors.eyeColor > 99) {
            throw new Error('Eye Color out of range (0-99).');
        }
        if (commonColors.eyebrowColor < 0 || commonColors.eyebrowColor > 99) {
            throw new Error('Eyebrow Color out of range (0-99).');
        }
        if (commonColors.mouthColor < 0 || commonColors.mouthColor > 99) {
            throw new Error('Mouth Color out of range (0-99).');
        }
        if (commonColors.beardColor < 0 || commonColors.beardColor > 99) {
            throw new Error('Beard Color out of range (0-99).');
        }
        if (commonColors.glassColor < 0 || commonColors.glassColor > 99) {
            throw new Error('Glass Color out of range (0-99).');
        }
        if (commonColors.glassType < 0 || commonColors.glassType > 19) {
            throw new Error('Glass Type out of range (0-19).');
        }

        // Pack common colors into core data's padding bits
        const packResults = packCommonColors(coreData, commonColors);

        // Display Ver3 and Ver4 indices, group indices, padding hex
        const results = `
Ver3 Indices:
    Face Color Ver3: ${packResults.ver3Indices.faceColorVer3}
    Hair Color Ver3: ${packResults.ver3Indices.hairColorVer3}
    Eye Color Ver3: ${packResults.ver3Indices.eyeColorVer3}
    Eyebrow Color Ver3: ${packResults.ver3Indices.eyebrowColorVer3}
    Mouth Color Ver3: ${packResults.ver3Indices.mouthColorVer3}
    Beard Color Ver3: ${packResults.ver3Indices.beardColorVer3}
    Glass Color Ver3: ${packResults.ver3Indices.glassColorVer3}
    Glass Type Ver3: ${packResults.ver3Indices.glassTypeVer3}

Group Indices:
    Face Color Group Index: ${packResults.groupIndices.faceColorGroupIndex}
    Hair Color Group Index: ${packResults.groupIndices.hairColorGroupIndex}
    Eye Color Group Index: ${packResults.groupIndices.eyeColorGroupIndex}
    Eyebrow Color Group Index: ${packResults.groupIndices.eyebrowColorGroupIndex}
    Mouth Color Group Index: ${packResults.groupIndices.mouthColorGroupIndex}
    Beard Color Group Index: ${packResults.groupIndices.beardColorGroupIndex}
    Glass Color Group Index: ${packResults.groupIndices.glassColorGroupIndex}
    Glass Type Group Index: ${packResults.groupIndices.glassTypeGroupIndex}

Padding Data Hex: ${packResults.paddingHex}
        `;
        document.getElementById('packCommonColorsResults').textContent = results;

        // Display encoded core data hex and fill decoder's input field
        const encodedCoreDataHex = packResults.encodedCoreDataHex;
        document.getElementById('packEncodedHex').value = encodedCoreDataHex;

        // Optionally, fill the decoder's input field if it exists
        document.getElementById('extractCoreData').value = encodedCoreDataHex;

    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// === Form 4: Extract Common Colors from Core Data ===

document.getElementById('extractCommonColorsForm').addEventListener('submit', function(e) {
    e.preventDefault();

    try {
        // Get input value
        const coreDataHex = document.getElementById('extractCoreData').value.trim();

        // Convert hex to byte array
        let coreData = hexToBytes(coreDataHex);

        // Ensure coreData is 72 bytes
        if (coreData.length < 72) {
            const paddedCoreData = new Uint8Array(72);
            paddedCoreData.set(coreData, 0);
            coreData = paddedCoreData;
        } else if (coreData.length > 72) {
            coreData = coreData.slice(0, 72);
        }

        // Unpack common colors from core data
        const unpackResults = unpackCommonColors(coreData);

        // Prepare results for display
        const commonColors = unpackResults.ver4Colors;
        const results = `
Reconstructed Common Colors (Ver4):
    Face Color: ${commonColors.faceColor}
    Hair Color: ${commonColors.hairColor}
    Eye Color: ${commonColors.eyeColor}
    Eyebrow Color: ${commonColors.eyebrowColor}
    Mouth Color: ${commonColors.mouthColor}
    Beard Color: ${commonColors.beardColor}
    Glass Color: ${commonColors.glassColor}
    Glass Type: ${commonColors.glassType}
        `;
        document.getElementById('extractedCommonColorsOutput').textContent = results;

    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// === Helper Functions ===

// Convert packed bits (BigInt) to byte array (6 bytes)
function packedBitsToBytes(bits) {
    const bytes = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
        bytes[i] = Number((bits >> (BigInt(i) * 8n)) & 0xFFn);
    }
    return bytes;
}
