// CHANGE THESE -------------------------------------------

const resourceFetchPath = "https://debian.local:8445/assets/web%20builds/AFLResHigh_2_3_LE_half_float.dat"; ///< Change this to something you can fetch() from.
const useAFL_2_3TextureHeader = true; ///< Set to false for FFL Wii U resources.

// --------------------------------------------------------


// Constants for resource header magic.
const FFLiResourceHeader_MagicBE = "FFRA";
const FFLiResourceHeader_MagicLE = "ARFF";
const FFLiResourceHeader_MagicU32 = 0x46465241;
// This sample tries? to detect endianness from the magic.
/**
 * Initializes FFLiResource* structures with struct-fu, returning the structs as an object.
 * 
 * @param {boolean} littleEndian - If true, parse the structures in little-endian, otherwise use big-endian.
 * @param {boolean} useAFL_2_3TextureHeader - If true, parse the structs using the texture header specification for AFLResHigh_2_3.dat.
 * @returns {{
 *   FFLiResourcePartsInfo: Object,
 *   FFLiResourceTextureHeader: Object,
 *   FFLiResourceShapeHeader: Object,
 *   FFLiResourceHeader: Object
 * }} An object containing FFL resource structures configured with the endianness provided.
 */
const createFFLiResourceStructs = (littleEndian, _useAFL_2_3TextureHeader) => {
    // Define uint32bi as uint32 but endian-specific.
    // Meant for this context only.
    Object.defineProperty(_, 'uint32bi', {
        get() { return littleEndian ? this.uint32le : this.uint32; },
        configurable: true, // Allow potentially removing or resetting later.
    });
    // TODO: better name (uint32 -> uint32be then make uint32 general?)
	// or TODO: into struct-fu in general? per-struct or global?

    // The structs below are based off of the FFL decomp by AboodXD: https://github.com/aboood40091/ffl/blob/0fe8e687dac5963000e3214a2c54d9219c99d63f/include/nn/ffl/FFLiResourceHeader.h

    // Makes up each texture and shape element.
    // ACCURACY?: see DWARF for nn::mii::detail::ResourceCommonAttribute
    const FFLiResourcePartsInfo = _.struct([
        _.uint32bi("dataPos"), // Offset in resource file.
        _.uint32bi("dataSize"),
        _.uint32bi("compressedSize"),
        _.uint8("compressLevel"), // FFLiResourceCompressLevel
        _.uint8("windowBits"), // enum FFLiResourceWindowBits
        _.uint8("memoryLevel"), // enum FFLiResourceMemoryLevel
        _.uint8("strategy") // enum FFLiResourceStrategy
    ]);

    // NOTE: This is for AFLResHigh_2_3.dat
    // ACCURACY?: see DWARF for nn::mii::detail::ResourceTextureHeader
    const FFLiResourceTextureHeader = (() => {
        // Use anonymous alias for useAFL_2_3TextureHeader.
        const afl = _useAFL_2_3TextureHeader;
        return _.struct([
            _.uint32bi("partsMaxSize", 11),
            _.struct("partsInfoBeard", [FFLiResourcePartsInfo], 3),
            _.struct("partsInfoCap", [FFLiResourcePartsInfo], 132),
            // Modify counts for eye, eyebrow, glass, mouth
            // based on whether the resource is from AFLResHigh_2_3.dat.
            _.struct("partsInfoEye", [FFLiResourcePartsInfo], afl ? 80 : 62),
            _.struct("partsInfoEyebrow", [FFLiResourcePartsInfo], afl ? 28 : 24),
            _.struct("partsInfoFaceline", [FFLiResourcePartsInfo], 12),
            _.struct("partsInfoFaceMakeup", [FFLiResourcePartsInfo], 12),
            _.struct("partsInfoGlass", [FFLiResourcePartsInfo], afl ? 20 : 9),
            _.struct("partsInfoMole", [FFLiResourcePartsInfo], 2),
            _.struct("partsInfoMouth", [FFLiResourcePartsInfo], afl ? 52 : 37),
            _.struct("partsInfoMustache", [FFLiResourcePartsInfo], 6),
            _.struct("partsInfoNoseline", [FFLiResourcePartsInfo], 18)
        ]);
    })();
    // For each texture PartsInfo, the data is the texture data
    // with the last 12 bytes corresponding to FFLiResourceTextureFooter:
    // Gets read here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/detail/FFLiResourceTexture.cpp#L24
    // Definition here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/detail/FFLiResourceTexture.h#L65

    // Same across all FFL and AFL resources.
    // Using Normal/Cap naming from my fork: https://github.com/ariankordi/ffl/commit/3c38d160c12e8384c4a752296c8422a9d98377c1
    const FFLiResourceShapeHeader = _.struct([
        _.uint32bi("partsMaxSize", 12),
        _.struct("partsInfoBeard", [FFLiResourcePartsInfo], 4),
        _.struct("partsInfoHatNormal", [FFLiResourcePartsInfo], 132),
        _.struct("partsInfoHatCap", [FFLiResourcePartsInfo], 132),
        _.struct("partsInfoFaceline", [FFLiResourcePartsInfo], 12),
        _.struct("partsInfoGlass", [FFLiResourcePartsInfo], 1),
        _.struct("partsInfoMask", [FFLiResourcePartsInfo], 12),
        _.struct("partsInfoNoseline", [FFLiResourcePartsInfo], 18),
        _.struct("partsInfoNose", [FFLiResourcePartsInfo], 18),
        _.struct("partsInfoHairNormal", [FFLiResourcePartsInfo], 132),
        _.struct("partsInfoHairCap", [FFLiResourcePartsInfo], 132),
        _.struct("partsInfoForeheadNormal", [FFLiResourcePartsInfo], 132),
        _.struct("partsInfoForeheadCap", [FFLiResourcePartsInfo], 132)
    ]);

    // For each shape PartsInfo, the data is FFLiResourceShapeDataHeader:
    // with the last 12 bytes corresponding to FFLiResourceTextureFooter:
    // Gets read here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/detail/FFLiResourceShape.cpp#L19
    // Definition here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/detail/FFLiResourceShape.h#L88

    // Top-level resource header.
    // ACCURACY?: no analog in nn::mii but there's DWARF for ResourceShapeHeader/ResourceTextureHeader
    const FFLiResourceHeader = _.struct([
        _.uint32bi("m_Magic"),
        _.uint32bi("m_Version"),
        _.uint32bi("m_UncompressBufferSize"),
        _.uint32bi("m_ExpandBufferSize"),
        _.uint32bi("m_IsExpand"),
        _.struct("m_TextureHeader", [FFLiResourceTextureHeader]),
        _.struct("m_ShapeHeader", [FFLiResourceShapeHeader]),
        _.uint32bi("_49d0", 12) // Unknown. Unused in FFL for NSMBU.
    ]);

    return {
    	// Export FFLiResourceHeader.
        FFLiResourceHeader,
    };
}

// Parse big-endian uint32 to four characters.
const charFromU32 = (i) => String.fromCharCode(
	// Assumes that i = uint32_t big-endian.
    (i >> 24) & 0xFF, ///< Highest byte (MSB).
    (i >> 16) & 0xFF, ///< Second highest byte.
    (i >> 8) & 0xFF,  ///< Second lowest byte.
    i & 0xFF          ///< Lowest byte (LSB).
);

// Entrypoint.
(async () => {
	// Download resource.
    const response = await fetch(resourceFetchPath);
    if (!response.ok) throw new Error("fetch response not ok");
    const resArrayBuffer = await response.arrayBuffer();
	console.log("📁 resArrayBuffer:", resArrayBuffer);

    // Peek at the magic for validity and determine endianness.
    // Read at offset 0 and littleEndian = false.
    const magicU32 = new DataView(resArrayBuffer).getUint32(0, false);
    const magic = charFromU32(magicU32);
	console.log(`🫣 peeked at magic (0x${magicU32.toString(16)}) = "${magic}"`);

    // Set endianness based on the value of magic.
    let littleEndian = false;
    if (magic === FFLiResourceHeader_MagicBE) {
	    littleEndian = false;
    	console.log("🔧 parsing in big-endian...");
    } else if (magic === FFLiResourceHeader_MagicLE) {
    	littleEndian = true;
        console.log("🦴 parsing in little-endian...");
    } else {
    	throw new Error("unknown magic, not parsing");
    }

	// Construct structs with specified endianness.
    const s = createFFLiResourceStructs(littleEndian, useAFL_2_3TextureHeader);

	// Parse FFLiResourceHeader to object.
    const resource = s.FFLiResourceHeader.unpack(resArrayBuffer);
    console.log("✅ FFLiResourceHeader.unpack result:", resource);
    if (resource.m_Magic !== FFLiResourceHeader_MagicU32) {
    	// print real and expected magic both in hex (base 16)
    	console.error(`❌ failed to parse magic, got: 0x${resource.m_Magic.toString(16)}, expected: 0x${FFLiResourceHeader_MagicU32.toString(16)}`);
    }

	// Extract m_ExpandBufferSize/total uncompressed resource size.
    const expandBufferSizeWithoutResHint = resource.m_ExpandBufferSize & 0x1FFFFFFF; // only last 29 bits, see FFLiResourceUtil.cpp
    const totalUncompressedResSizeMB = Math.trunc(expandBufferSizeWithoutResHint / (1024 * 1024));

    if (totalUncompressedResSizeMB > 75) {
	    // Assert if the resource is suspiciously large, assuming the number was read wrong.
    	console.error(`🤨 you sure this resource is ${totalUncompressedResSizeMB} MB large?`);
    }

    console.log(`ℹ️ resource total uncompressed size: ${totalUncompressedResSizeMB} MB`);
    console.log("🖼️ m_TextureHeader:", resource.m_TextureHeader);
    console.log("📐 m_ShapeHeader:", resource.m_ShapeHeader);
})();