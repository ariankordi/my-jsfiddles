// Set up the scene, camera, and renderer
const scene = new THREE.Scene();

// Set a pastel purple background color
// already set by html background
//scene.background = new THREE.Color(0xE6E6FA); // Light lavender

// Perspective camera with specified parameters
const fov = 15; // Field of view in degrees
const aspect = window.innerWidth / window.innerHeight; // Aspect ratio
const near = 10; // Near clipping plane
const far = 10000; // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position the camera and set the lookAt point
camera.position.set(0, 37.05, 415.53); // Camera position
camera.lookAt(new THREE.Vector3(0, 37.05, 0)); // LookAt point

// Initialize the WebGL renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow mouse interaction
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 37.05, 0);
controls.update();

// Variables to control rotation
let isRotating = true;
let rotationSpeed = parseFloat(document.getElementById('rotationSpeed').value);

// Variable to hold the loaded model
let model = null;

// Material table for FFLDefaultShader mapping to FFLModulateType
// Reference: https://github.com/aboood40091/FFL-Testing/blob/master/src/Shader.cpp
const cMaterialParam = [
    { // FFL_MODULATE_TYPE_SHAPE_FACELINE
        ambient: new THREE.Vector4(0.85, 0.75, 0.75, 1.0),
        diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
        specular: new THREE.Vector4(0.30, 0.30, 0.30, 1.0),
        specularPower: 1.2,
        specularMode: 0
    },
    { // FFL_MODULATE_TYPE_SHAPE_BEARD
        ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
        diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
        specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
        specularPower: 40.0,
        specularMode: 1
    },
    { // FFL_MODULATE_TYPE_SHAPE_NOSE
        ambient: new THREE.Vector4(0.90, 0.85, 0.85, 1.0),
        diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
        specular: new THREE.Vector4(0.22, 0.22, 0.22, 1.0),
        specularPower: 1.5,
        specularMode: 0
    },
    { // FFL_MODULATE_TYPE_SHAPE_FOREHEAD
        ambient: new THREE.Vector4(0.85, 0.75, 0.75, 1.0),
        diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
        specular: new THREE.Vector4(0.30, 0.30, 0.30, 1.0),
        specularPower: 1.2,
        specularMode: 0
    },
    { // FFL_MODULATE_TYPE_SHAPE_HAIR
        ambient: new THREE.Vector4(1.00, 1.00, 1.00, 1.0),
        diffuse: new THREE.Vector4(0.70, 0.70, 0.70, 1.0),
        specular: new THREE.Vector4(0.35, 0.35, 0.35, 1.0),
        specularPower: 10.0,
        specularMode: 1
    },
    { // FFL_MODULATE_TYPE_SHAPE_CAP
        ambient: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
        diffuse: new THREE.Vector4(0.72, 0.72, 0.72, 1.0),
        specular: new THREE.Vector4(0.30, 0.30, 0.30, 1.0),
        specularPower: 1.5,
        specularMode: 0
    },
    { // FFL_MODULATE_TYPE_SHAPE_MASK
        ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
        diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
        specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
        specularPower: 40.0,
        specularMode: 1
    },
    { // FFL_MODULATE_TYPE_SHAPE_NOSELINE
        ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
        diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
        specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
        specularPower: 40.0,
        specularMode: 1
    },
    { // FFL_MODULATE_TYPE_SHAPE_GLASS
        ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
        diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
        specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
        specularPower: 40.0,
        specularMode: 1
    }
];

// FFLDefaultShader default lighting parameters
const cLightAmbient  = new THREE.Vector4(0.73, 0.73, 0.73, 1.0);
const cLightDiffuse  = new THREE.Vector4(0.60, 0.60, 0.60, 1.0);
const cLightSpecular = new THREE.Vector4(0.70, 0.70, 0.70, 1.0);
// Light direction derived from this vector: [-0.65, 0.36]
const cLightDir      = new THREE.Vector3(-0.4531539381, 0.4226179123, 0.7848858833);
const cRimColor      = new THREE.Vector4(0.3, 0.3, 0.3, 1.0);
const cRimPower      = 2.0;


// Select the Load Model button to later disable/re-enable it
const loadModelButton = document.getElementById('loadModelButton');

// Function to load the glTF model from a URL
const loadModel = (url) => {
    // Disable the Load Model button when loading starts
    if (loadModelButton)
        loadModelButton.disabled = true;

    // Remove existing model if any
    if (model) {
        scene.remove(model);
        model.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        model = null;
    }

    // Instantiate the GLTFLoader
    const loader = new THREE.GLTFLoader();

    // Load the glTF model
    loader.load(
        url,
        (gltf) => {
            // Extract the loaded scene/model
            model = gltf.scene;

            // Traverse the model to access its meshes
            model.traverse(node => {
                if (node.isMesh) {
                    const originalMaterial = node.material;

                    // Access userData from geometry
                    const userData = node.geometry.userData;

                    // Retrieve modulateType and map to material parameters
                    const modulateType = userData.modulateType;
                    if (userData.modulateType === undefined)
                        console.warn(`Mesh "${node.name}" is missing "modulateType" in userData.`);

                    // HACK for now: disable lighting on mask, glass, noseline
                    // (Because there is some lighting bug affecting
                    // those that does not happen in FFL-Testing)
                    const lightEnable = (modulateType > 5) ? false : true;
                    // Select material parameter based on the modulate type, default to faceline
                    const materialParam = modulateType && modulateType < 9
                    ? cMaterialParam[modulateType]
                    : cMaterialParam[0];

                    // Retrieve modulateMode, defaulting to constant color
                    const modulateMode = userData.modulateMode === undefined ? 0 : userData.modulateMode;

                    // Retrieve modulateColor (vec3)
                    let modulateColor;
                    if (!userData.modulateColor) {
                        console.warn(`Mesh "${node.name}" is missing "modulateColor" in userData.`);
                        // Default to red if missing
                        modulateColor = new THREE.Vector4(...([1, 0, 0]), 1);
                    } else {
                        modulateColor = new THREE.Vector4(...(userData.modulateColor), 1);
                    }

                    // Define macros based on the presence of textures
                    const defines = {};
                    if (originalMaterial.map)
                        defines.USE_MAP = '';

                    // Function to Map FFLCullMode to three.js material side
                    let side = originalMaterial.side;
                    if (userData.cullMode !== undefined) {
                        switch (userData.cullMode) {
                            case 0: // FFL_CULL_MODE_NONE
                                side = THREE.DoubleSide; // No culling
                                break;
                            case 1: // FFL_CULL_MODE_BACK
                                side = THREE.FrontSide;  // Cull back faces, render front
                                break;
                            case 2: // FFL_CULL_MODE_FRONT
                                side = THREE.BackSide;   // Cull front faces, render back
                                break;
                        }
                    }

                    // Create a custom ShaderMaterial
                    const shaderMaterial = new THREE.ShaderMaterial({
                        vertexShader: document.getElementById('vertexShader').textContent,
                        fragmentShader: document.getElementById('fragmentShader').textContent,
                        uniforms: {
                            u_const1: { value: modulateColor },
                            u_light_ambient: { value: cLightAmbient },
                            u_light_diffuse: { value: cLightDiffuse },
                            u_light_specular: { value: cLightSpecular },
                            u_light_dir: { value: cLightDir },
                            u_light_enable: { value: lightEnable },
                            u_material_ambient: { value: materialParam.ambient },
                            u_material_diffuse: { value: materialParam.diffuse },
                            u_material_specular: { value: materialParam.specular },
                            u_material_specular_mode: { value: materialParam.specularMode },
                            u_material_specular_power: { value: materialParam.specularPower },
                            u_mode: { value: modulateMode },
                            u_rim_color: { value: cRimColor },
                            u_rim_power: { value: cRimPower },
                            s_texture: { value: originalMaterial.map }
                        },
                        defines: defines,
                        side: side,
                        // NOTE: usually these blend modes are
                        // only set for DrawXlu stage
                        blending: THREE.CustomBlending,
                        blendDstAlpha: THREE.OneFactor,
                        transparent: originalMaterial.transparent, // Handle transparency
                        alphaTest: originalMaterial.alphaTest // Handle alpha testing
                    });

                    // Assign the custom material to the mesh
                    node.material = shaderMaterial;
                }
            });

            // Add the model to the scene
            scene.add(model);

            // Re-enable the Load Model button after loading completes
            loadModelButton.disabled = false;
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the model:', error);
            alert('An error occurred while loading the model: ' + error.toString());
            // Re-enable the Load Model button if there's an error
            loadModelButton.disabled = false;
        }
    );
};

// Animation loop
const animate = () => {
    requestAnimationFrame(animate);

    // Rotate the model around the Y-axis if rotation is enabled
    if (model && isRotating) {
        model.rotation.y += rotationSpeed;
    }

    // Render the scene from the camera's perspective
    renderer.render(scene, camera);
};

// Handle window resize events
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// Handle form submission to load a new model
document.getElementById('modelForm').addEventListener('submit', event => {
    event.preventDefault(); // Prevent the default form submission behavior
    const url = document.getElementById('modelUrl').value.trim();
    if (url) loadModel(url); // Load the model from the specified URL
    else alert('Please enter a URL to a valid model in glTF format.');
});

let isPausedByButton = false; // Tracks if rotation is paused via the pause button
let isPausedByMouse = false;  // Tracks if rotation is paused via mouse interaction

// Handle pause and resume buttons visibility and rotation state
document.getElementById('pauseButton').addEventListener('click', function () {
    isPausedByButton = true;
    isRotating = false;
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'block';
});

document.getElementById('resumeButton').addEventListener('click', function () {
    isPausedByButton = false;
    isRotating = true;
    pauseButton.style.display = 'block';
    resumeButton.style.display = 'none';
});

// Add event listeners to the renderer's DOM element for mouse interactions
renderer.domElement.addEventListener('pointerdown', () => {
    if (!isPausedByButton && isRotating) { 
        isRotating = false;
        isPausedByMouse = true;
    }
});

// Handle mouse up event to restart rotation if it wasn't paused by the button
renderer.domElement.addEventListener('pointerup', () => {
    if (isPausedByMouse && !isPausedByButton) { 
        isRotating = true;
        isPausedByMouse = false;
    }
});

// Handle rotation speed slider
document.getElementById('rotationSpeed').addEventListener('input', function () {
    rotationSpeed = parseFloat(this.value) || 0;
});

// Toggle UI functionality
const hideUiButton = document.getElementById('hideUiButton');
const showUiButton = document.getElementById('showUiButton');
const ui = document.getElementById('ui');

hideUiButton.addEventListener('click', () => {
    ui.style.display = 'none';
    showUiButton.style.display = '';
});
showUiButton.addEventListener('click', () => {
    ui.style.display = '';
    showUiButton.style.display = 'none';
});

// Initialize light direction sliders
const lightDirX = document.getElementById('lightDirX');
const lightDirY = document.getElementById('lightDirY');
const lightDirZ = document.getElementById('lightDirZ');
// Function to update the light direction in the shader
const updateLightDirection = () => {
    const x = parseFloat(lightDirX.value);
    const y = parseFloat(lightDirY.value);
    const z = parseFloat(lightDirZ.value);
    // Normalize new user-provided light direction
    const lightDir = new THREE.Vector3(x, y, z).normalize();

    // Ensure model exists before traversing
    model && model.traverse(node => {
        // Update the uniform for all shader materials
        if (node.isMesh && node.material.uniforms)
            node.material.uniforms.u_light_dir.value = lightDir;
    });
};
// Add event listeners to update the light direction when sliders change
lightDirX.addEventListener('input', updateLightDirection);
lightDirY.addEventListener('input', updateLightDirection);
lightDirZ.addEventListener('input', updateLightDirection);
// Function to reset the light direction to default const values
const resetLightDirection = () => {
    // Reset inputs to const values
    lightDirX.value = cLightDir.x;
    lightDirY.value = cLightDir.y;
    lightDirZ.value = cLightDir.z;
    updateLightDirection(); // Update the shader with the default values
};
// Add event listener to the reset button
document.getElementById('resetLightButton').addEventListener('click', resetLightDirection);



// Load the default model on startup
loadModel(document.getElementById('modelUrl').value);

// Start the animation loop
animate();
