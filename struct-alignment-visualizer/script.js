// Define type sizes and alignments (simplified for example)
const typeInfo = {
  // Basic Data Types
  'char': { size: 1, alignment: 1 },
  'signed char': { size: 1, alignment: 1 },
  'unsigned char': { size: 1, alignment: 1 },
  'short': { size: 2, alignment: 2 },
  'signed short': { size: 2, alignment: 2 },
  'unsigned short': { size: 2, alignment: 2 },
  'short int': { size: 2, alignment: 2 },
  'signed short int': { size: 2, alignment: 2 },
  'unsigned short int': { size: 2, alignment: 2 },
  'int': { size: 4, alignment: 4 },
  'signed int': { size: 4, alignment: 4 },
  'unsigned int': { size: 4, alignment: 4 },
  'long': { size: 8, alignment: 8 },
  'signed long': { size: 8, alignment: 8 },
  'unsigned long': { size: 8, alignment: 8 },
  'long int': { size: 8, alignment: 8 },
  'signed long int': { size: 8, alignment: 8 },
  'unsigned long int': { size: 8, alignment: 8 },
  'long long': { size: 8, alignment: 8 },
  'signed long long': { size: 8, alignment: 8 },
  'unsigned long long': { size: 8, alignment: 8 },
  'long long int': { size: 8, alignment: 8 },
  'signed long long int': { size: 8, alignment: 8 },
  'unsigned long long int': { size: 8, alignment: 8 },

  // Fixed-Width Integer Types (from <stdint.h>)
  'int8_t': { size: 1, alignment: 1 },
  'uint8_t': { size: 1, alignment: 1 },
  'int16_t': { size: 2, alignment: 2 },
  'uint16_t': { size: 2, alignment: 2 },
  'int32_t': { size: 4, alignment: 4 },
  'uint32_t': { size: 4, alignment: 4 },
  'int64_t': { size: 8, alignment: 8 },
  'uint64_t': { size: 8, alignment: 8 },

  // Floating-Point Types
  'float': { size: 4, alignment: 4 },
  'double': { size: 8, alignment: 8 },
  'long double': { size: 16, alignment: 16 }, // Varies by platform

  // Boolean Type
  '_Bool': { size: 1, alignment: 1 },
  'bool': { size: 1, alignment: 1 }, // From <stdbool.h>

  // Enumerations
  'enum': { size: 4, alignment: 4 }, // Typically same as int

  // Void Type (for pointers)
  'void': { size: 0, alignment: 1 }, // Not used directly

  // Pointer Types (Assuming 64-bit architecture)
  'void*': { size: 8, alignment: 8 },
  'char*': { size: 8, alignment: 8 },
  'short*': { size: 8, alignment: 8 },
  'int*': { size: 8, alignment: 8 },
  'long*': { size: 8, alignment: 8 },
  'float*': { size: 8, alignment: 8 },
  'double*': { size: 8, alignment: 8 },
  'long double*': { size: 8, alignment: 8 },
  'bool*': { size: 8, alignment: 8 },
  'enum*': { size: 8, alignment: 8 },

  // Size Types
  'size_t': { size: 8, alignment: 8 },
  'ssize_t': { size: 8, alignment: 8 },
  'ptrdiff_t': { size: 8, alignment: 8 },

  // Additional Types
  'uintptr_t': { size: 8, alignment: 8 },
  'intptr_t': { size: 8, alignment: 8 },

  // Structs and Unions (Sizes to be calculated dynamically)
  // You can handle these separately or define default sizes
  // 'struct': { size: 0, alignment: 1 }, // Placeholder
  // 'union': { size: 0, alignment: 1 },  // Placeholder
};


// Store typedefs
const typedefs = {};

function removeComments(code) {
  // Remove single-line comments (// ...) and multi-line comments (/* ... */)
  return code.replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
}

function parseStruct(input) {
    // Remove comments from input
    input = removeComments(input);

    // Updated regex to handle both regular struct and typedef struct definitions
    const structRegex = /struct\s*(\w*)\s*\{([^}]+)\}\s*(\w*);/;
    const typedefRegex = /typedef\s+struct\s*\{([^}]+)\}\s*(\w+);/;
    
    let structName = null;
    let membersStr = null;

    // Check for typedef struct
    if (typedefRegex.test(input)) {
        const typedefMatch = input.match(typedefRegex);
        membersStr = typedefMatch[1].trim();
        structName = typedefMatch[2].trim();  // The typedef name
    } 
    // Check for regular struct
    else if (structRegex.test(input)) {
        const structMatch = input.match(structRegex);
        membersStr = structMatch[2].trim();
        structName = structMatch[1].trim();  // The struct name
    } else {
        alert('Invalid struct definition.');
        return null;
    }

    const membersLines = membersStr.split(';').map(line => line.trim()).filter(line => line.length > 0);

    const members = [];

    // Parse each member
    membersLines.forEach(line => {
        const arrayMatch = line.match(/(.+?)\s+(\w+)\s*\[\s*(\d*)\s*\]/);
        if (arrayMatch) {
            const type = arrayMatch[1].trim();
            const name = arrayMatch[2].trim();
            const arraySize = parseInt(arrayMatch[3] || '1', 10);  // Default to 1 if not specified
            members.push({ type, name, arraySize });
        } else {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                const type = parts.slice(0, -1).join(' ');
                const name = parts[parts.length - 1];
                members.push({ type, name });
            }
        }
    });

    // Store struct definition with or without typedef
    if (structName.startsWith('struct')) {
        typedefs[structName] = { members };
    } else {
        typedefs[`struct ${structName}`] = { members };
    }

    return { name: structName, members };
}

function resolveType(type) {
  // Resolve typedefs recursively
  while (typedefs[type]) {
    // For simplicity, assume typedefs are structs
    return typedefs[type];
  }
  return type;
}

function visualizeStruct() {
  const input = document.getElementById('structInput').value;
  const struct = parseStruct(input);
  if (!struct) return;

  let offset = 0;
  let totalSize = 0; // Initialize total size
  const visualization = [];
  const members = struct.members;

  // Calculate offsets, padding
  members.forEach(member => {
    let type = member.type;
    let size, alignment;

    // Resolve typedefs if necessary
    const resolved = resolveType(type);
    if (typeof resolved === 'string') {
      if (!typeInfo[type]) {
        alert(`Unknown type: ${type}`);
        return;
      }
      size = typeInfo[type].size;
      alignment = typeInfo[type].alignment;
    } else {
      alert('Nested structs are not supported in this example.');
      return;
    }

    // If member is an array
    if (member.arraySize) {
      size = typeInfo[type].size * member.arraySize;
      type = `${type} [${member.arraySize}]`;
    }

    // Calculate padding
    const padding = (alignment - (offset % alignment)) % alignment;
    if (padding > 0) {
      visualization.push({ name: `Padding (${padding} bytes)`, size: padding, padding: true, offset });
      offset += padding;
    }

    // Add member
    visualization.push({ name: member.name, type, size, padding: false, offset });
    offset += size;
    totalSize += size + padding; // Add size and padding to total
  });

  // Optional: Add struct padding to align the struct size to the max alignment
  const maxAlignment = Math.max(...members.map(m => typeInfo[m.type]?.alignment || 1));
  const totalPadding = (maxAlignment - (offset % maxAlignment)) % maxAlignment;
  if (totalPadding > 0) {
    visualization.push({ name: `Padding (${totalPadding} bytes)`, size: totalPadding, padding: true, offset });
    offset += totalPadding;
    totalSize += totalPadding; // Add to total size
  }

  // Render visualization
  const container = document.getElementById('visualization');
  container.innerHTML = `<div class="struct-header">struct ${struct.name} {</div>`;
  visualization.forEach(item => {
    const div = document.createElement('div');
    div.className = 'member';
    if (item.padding) div.classList.add('padding');
    div.innerHTML = `<span>${item.name}</span><span>Offset: ${item.offset}</span>`;
    container.appendChild(div);
  });

  // Display total size
  container.innerHTML += `<div class="struct-header">};</div>`;
  container.innerHTML += `<div class="struct-header">Total Size: ${totalSize} bytes</div>`;
}

