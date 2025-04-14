// Ensure SimplexNoise is available before using it
let noise;
try {
    noise = new SimplexNoise();
} catch (error) {
    console.error("SimplexNoise error:", error);
    // Fallback implementation of noise for when the library isn't available
    noise = {
        noise3D: function(x, y, z) {
            return (Math.sin(x * 10) + Math.sin(y * 10) + Math.sin(z * 10)) / 3;
        }
    };
}

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.getElementById('container').appendChild(renderer.domElement);

// Create universe group
const universe = new THREE.Group();
scene.add(universe);

// Set camera position
camera.position.set(0, 2000, 0);
camera.lookAt(0, 0, 0);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x202020);
scene.add(ambientLight);

// Initialize controls
let orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.maxDistance = 20000;
orbitControls.minDistance = 0.1; // Allow very close zoom to see small details
orbitControls.zoomSpeed = 2.5; // Faster default zoom for the scroll wheel
orbitControls.rotateSpeed = 1.2; // Slightly faster rotation
orbitControls.panSpeed = 1.5; // Faster panning
orbitControls.screenSpacePanning = true; // More intuitive panning

let flyControls = new THREE.FlyControls(camera, renderer.domElement);
flyControls.movementSpeed = 100;
flyControls.rollSpeed = 0.05;
flyControls.autoForward = false;
flyControls.dragToLook = true;

// Default to orbit controls
let activeControls = 'orbit';
flyControls.enabled = false;

// Add mouse wheel handler for adaptive zoom speed based on distance
renderer.domElement.addEventListener('wheel', function(event) {
    if (activeControls !== 'orbit') return;
    
    // Get current distance to target
    const distanceToTarget = camera.position.distanceTo(orbitControls.target);
    
    // Set zoom speed based on distance - faster when far, precise when close
    if (distanceToTarget < 10) {
        // Very fine zoom for examining details
        orbitControls.zoomSpeed = 0.8;
    } else if (distanceToTarget < 100) {
        // Medium zoom speed 
        orbitControls.zoomSpeed = 1.5;
    } else if (distanceToTarget < 1000) {
        // Faster zoom speed
        orbitControls.zoomSpeed = 3.0;
    } else {
        // Very fast zoom for long distances
        orbitControls.zoomSpeed = 5.0;
    }
}, { passive: true });

// Initialize CSS2D renderer
const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// Initialize clock for animation
const clock = new THREE.Clock();

// Create the universe
let galaxies = [];
let currentView = 'universe';
let currentSystem = null;

// Generate a random color
function getRandomColor() {
    const colors = [
        0xffff00, 0xff8800, 0xff0000, 0xffccaa,
        0x88ccff, 0xaaaaff, 0x4444ff, 0xcc88ff,
        0xffaacc, 0x44ccff, 0x00ff88, 0xccffaa
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Blend two colors
function blendColors(color1, color2, ratio) {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    
    const r = c1.r * (1 - ratio) + c2.r * ratio;
    const g = c1.g * (1 - ratio) + c2.g * ratio;
    const b = c1.b * (1 - ratio) + c2.b * ratio;
    
    return new THREE.Color(r, g, b);
}

// Create star background - Fixed to make stars part of the actual scene, not just a background
function createStarBackground() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
    });
    
    const starsVertices = [];
    for (let i = 0; i < 20000; i++) {
        // Create stars in a spherical distribution around the camera starting point
        const radius = 20000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // Make stars fixed relative to camera
    stars.userData = {
        isBackgroundStars: true
    };
    
    return stars;
}

// Constants for scientific calculations
const STELLAR_CLASSES = [
    {type: 'O', temp: 30000, color: 0x9bb0ff, mass: 50, luminosity: 100000, rarity: 0.00003},
    {type: 'B', temp: 20000, color: 0xaabfff, mass: 10, luminosity: 1000, rarity: 0.0013},
    {type: 'A', temp: 8500, color: 0xcad7ff, mass: 3, luminosity: 80, rarity: 0.006},
    {type: 'F', temp: 6500, color: 0xf8f7ff, mass: 1.5, luminosity: 6, rarity: 0.03},
    {type: 'G', temp: 5500, color: 0xfff4ea, mass: 1, luminosity: 1, rarity: 0.076}, // Sun-like
    {type: 'K', temp: 4500, color: 0xffd2a1, mass: 0.7, luminosity: 0.1, rarity: 0.121},
    {type: 'M', temp: 3000, color: 0xffcc6f, mass: 0.2, luminosity: 0.008, rarity: 0.765}
];

// Get a random star class based on realistic distribution
function getRandomStarClass() {
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (const stellarClass of STELLAR_CLASSES) {
        cumulativeProbability += stellarClass.rarity;
        if (rand <= cumulativeProbability) {
            return stellarClass;
        }
    }
    
    // Default to M-class (most common)
    return STELLAR_CLASSES[STELLAR_CLASSES.length - 1];
}

// Calculate orbital period using Kepler's Third Law
function calculateOrbitalPeriod(semiMajorAxis, centralMass) {
    return Math.sqrt(Math.pow(semiMajorAxis, 3) / centralMass);
}

// Life classification system
const LIFE_TYPES = [
    { id: 'none', name: 'No Life', description: 'No detectable life forms', rarity: 0.60 },
    { id: 'microbial', name: 'Microbial Life', description: 'Simple unicellular organisms', rarity: 0.15 },
    { id: 'primitive', name: 'Primitive Life', description: 'Multicellular organisms, simple ecosystems', rarity: 0.10 },
    { id: 'complex', name: 'Complex Life', description: 'Advanced ecosystems, animal-like organisms', rarity: 0.07 },
    { id: 'intelligent', name: 'Intelligent Life', description: 'Species with tool use and complex societies', rarity: 0.05 },
    { id: 'advanced', name: 'Advanced Civilization', description: 'Space-faring civilization with advanced technology', rarity: 0.03 }
];

// Civilization details for intelligent species
const CIVILIZATION_TYPES = [
    { id: 'tribal', name: 'Tribal Society', description: 'Pre-industrial tribal groups', technology: 'Primitive tools', rarity: 0.30 },
    { id: 'medieval', name: 'Medieval Society', description: 'Early agricultural civilizations', technology: 'Basic metallurgy', rarity: 0.25 },
    { id: 'industrial', name: 'Industrial Society', description: 'Industrialized civilization', technology: 'Steam engines, electricity', rarity: 0.15 },
    { id: 'information', name: 'Information Society', description: 'Digital civilization', technology: 'Computers, global communications', rarity: 0.10 },
    { id: 'space', name: 'Space Age', description: 'Early space exploration', technology: 'Basic space travel, satellites', rarity: 0.08 },
    { id: 'interplanetary', name: 'Interplanetary Society', description: 'Colonized multiple planets in their system', technology: 'Fusion power, interplanetary ships', rarity: 0.07 },
    { id: 'advanced', name: 'Advanced Society', description: 'Highly advanced civilization', technology: 'Quantum computing, antimatter power', rarity: 0.05 }
];

// Space station types
const STATION_TYPES = [
    { id: 'research', name: 'Research Station', description: 'Scientific outpost', scale: 0.05, color: 0x22aaff },
    { id: 'mining', name: 'Mining Station', description: 'Resource extraction facility', scale: 0.08, color: 0xaa8866 },
    { id: 'colony', name: 'Colony Station', description: 'Permanent space colony', scale: 0.12, color: 0x66cc99 },
    { id: 'military', name: 'Military Outpost', description: 'Defense or monitoring station', scale: 0.06, color: 0xff3333 },
    { id: 'trade', name: 'Trade Hub', description: 'Commercial space station', scale: 0.10, color: 0xffcc22 }
];

// Create space station meshes for visual representation
function createSpaceStation(type, planetSize) {
    const stationType = STATION_TYPES.find(s => s.id === type) || STATION_TYPES[0];
    
    // Create station group
    const stationGroup = new THREE.Group();
    stationGroup.userData = { type: 'station' };
    
    // Calculate size based on station type and planet size
    const baseSize = planetSize * stationType.scale;
    
    // Create different geometries based on station type
    let mainGeometry;
    
    switch(type) {
        case 'research': // Spherical research station with antennas
            mainGeometry = new THREE.SphereGeometry(baseSize, 8, 8);
            break;
        case 'mining': // Cylindrical mining station
            mainGeometry = new THREE.CylinderGeometry(baseSize * 0.7, baseSize * 1.1, baseSize * 2, 8);
            break;
        case 'colony': // Ring-shaped colony
            mainGeometry = new THREE.TorusGeometry(baseSize * 1.5, baseSize * 0.4, 8, 16);
            break;
        case 'military': // Diamond-shaped military station
            mainGeometry = new THREE.OctahedronGeometry(baseSize, 1);
            break;
        case 'trade': // Cross-shaped trade hub
            mainGeometry = new THREE.BoxGeometry(baseSize * 2, baseSize * 0.5, baseSize * 0.5);
            break;
        default:
            mainGeometry = new THREE.BoxGeometry(baseSize, baseSize, baseSize);
    }
    
    // Create main station body
    const mainMaterial = new THREE.MeshBasicMaterial({ color: stationType.color });
    const mainBody = new THREE.Mesh(mainGeometry, mainMaterial);
    stationGroup.add(mainBody);
    
    // Add details specific to the station type
    if (type === 'research') {
        // Add antenna arrays
        const antennaGeometry = new THREE.CylinderGeometry(baseSize * 0.02, baseSize * 0.02, baseSize * 2, 4);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        
        for (let i = 0; i < 3; i++) {
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            const angle = (i / 3) * Math.PI * 2;
            antenna.position.set(
                Math.cos(angle) * baseSize, 
                Math.sin(angle) * baseSize,
                0
            );
            antenna.rotation.z = angle + Math.PI/2;
            stationGroup.add(antenna);
        }
    } else if (type === 'colony') {
        // Add central hub
        const hubGeometry = new THREE.SphereGeometry(baseSize * 0.8, 8, 8);
        const hubMaterial = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        const hub = new THREE.Mesh(hubGeometry, hubMaterial);
        stationGroup.add(hub);
        
        // Add spokes
        const spokeGeometry = new THREE.CylinderGeometry(baseSize * 0.1, baseSize * 0.1, baseSize * 1.4, 6);
        const spokeMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        
        for (let i = 0; i < 4; i++) {
            const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
            const angle = (i / 4) * Math.PI * 2;
            spoke.position.set(
                Math.cos(angle) * baseSize * 0.75, 
                Math.sin(angle) * baseSize * 0.75,
                0
            );
            spoke.rotation.z = angle + Math.PI/2;
            stationGroup.add(spoke);
        }
    } else if (type === 'military') {
        // Add weapon turrets
        const turretGeometry = new THREE.ConeGeometry(baseSize * 0.2, baseSize * 0.5, 4);
        const turretMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
        
        for (let i = 0; i < 4; i++) {
            const turret = new THREE.Mesh(turretGeometry, turretMaterial);
            // Position at vertices
            turret.position.set(
                (i % 2 === 0 ? 1 : -1) * baseSize,
                (i < 2 ? 1 : -1) * baseSize,
                0
            );
            turret.lookAt(0, 0, 0);
            stationGroup.add(turret);
        }
    } else if (type === 'trade') {
        // Add second cross bar
        const crossGeometry = new THREE.BoxGeometry(baseSize * 0.5, baseSize * 0.5, baseSize * 2);
        const crossMaterial = new THREE.MeshBasicMaterial({ color: stationType.color });
        const crossBar = new THREE.Mesh(crossGeometry, crossMaterial);
        stationGroup.add(crossBar);
        
        // Add central hub
        const hubGeometry = new THREE.SphereGeometry(baseSize * 0.6, 8, 8);
        const hubMaterial = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        const hub = new THREE.Mesh(hubGeometry, hubMaterial);
        stationGroup.add(hub);
    } else if (type === 'mining') {
        // Add solar panels
        const panelGeometry = new THREE.BoxGeometry(baseSize * 2, baseSize * 0.05, baseSize * 0.8);
        const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x2244aa });
        
        const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel1.position.set(0, baseSize * 1.2, 0);
        stationGroup.add(panel1);
        
        const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
        panel2.position.set(0, -baseSize * 1.2, 0);
        stationGroup.add(panel2);
    }
    
    // Add mounting arm to connect to orbit
    const mountGeometry = new THREE.CylinderGeometry(baseSize * 0.05, baseSize * 0.05, baseSize * 0.5, 6);
    const mountMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.rotation.z = Math.PI / 2;
    mount.position.x = -baseSize * 0.25;
    stationGroup.add(mount);
    
    return stationGroup;
}

// Get a random life type based on rarity
function getRandomLifeType() {
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (const lifeType of LIFE_TYPES) {
        cumulativeProbability += lifeType.rarity;
        if (rand <= cumulativeProbability) {
            return { ...lifeType };
        }
    }
    
    // Default to no life
    return { ...LIFE_TYPES[0] };
}

// Get random civilization details for intelligent species
function getRandomCivilizationType() {
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (const civType of CIVILIZATION_TYPES) {
        cumulativeProbability += civType.rarity;
        if (rand <= cumulativeProbability) {
            return { ...civType };
        }
    }
    
    // Default to tribal
    return { ...CIVILIZATION_TYPES[0] };
}

// Generate life details for a planet
function generateLifeDetails(planetType, inHabitableZone) {
    // Life is much more likely in habitable zones - increased multiplier
    let lifeChanceMultiplier = inHabitableZone ? 8.0 : 0.3;
    
    // Adjust based on planet type
    if (planetType.includes('Gas Giant')) {
        lifeChanceMultiplier *= 0.2; // Very unlikely in gas giants but slightly increased
    } else if (planetType.includes('Frozen')) {
        lifeChanceMultiplier *= 0.4; // Unlikely but possible in frozen worlds
    } else if (planetType.includes('Habitable')) {
        lifeChanceMultiplier *= 3.0; // Very likely on habitable worlds
    }
    
    // Get life type based on adjusted probabilities
    const lifeType = getRandomLifeType();
    
    // Apply the multiplier to the rarity check - reduced threshold
    if (Math.random() > lifeChanceMultiplier * lifeType.rarity * 1.5) {
        return { ...LIFE_TYPES[0] }; // No life
    }
    
    // For intelligent life, generate civilization details
    let civilizationDetails = null;
    if (lifeType.id === 'intelligent' || lifeType.id === 'advanced') {
        civilizationDetails = getRandomCivilizationType();
        
        // Advanced life type always gets advanced civilization types
        if (lifeType.id === 'advanced' && civilizationDetails.id === 'tribal') {
            civilizationDetails = CIVILIZATION_TYPES[CIVILIZATION_TYPES.length - 1];
        }
    }
    
    // Generate space stations for advanced civilizations
    let spaceStations = [];
    if (civilizationDetails && 
        (civilizationDetails.id === 'space' || 
         civilizationDetails.id === 'interplanetary' || 
         civilizationDetails.id === 'advanced')) {
        
        // Increased station count: 2-5 instead of 1-3
        const stationCount = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < stationCount; i++) {
            const stationType = STATION_TYPES[Math.floor(Math.random() * STATION_TYPES.length)];
            spaceStations.push({
                ...stationType,
                size: Math.floor(Math.random() * 3) + 1, // 1-3 size
                population: Math.floor(Math.random() * 5000) + 100, // 100-5100 population
                established: `${2100 + Math.floor(Math.random() * 900)} CE` // Random year
            });
        }
    }
    // Also add a small chance for space stations with information-age civilizations
    else if (civilizationDetails && civilizationDetails.id === 'information' && Math.random() < 0.3) {
        // Early space program - just one station
        const stationType = STATION_TYPES[0]; // Research station
        spaceStations.push({
            ...stationType,
            size: 1, // Small size
            population: Math.floor(Math.random() * 100) + 10, // 10-110 population
            established: `${2100 + Math.floor(Math.random() * 100)} CE` // Recent establishment
        });
    }
    
    return {
        ...lifeType,
        biosphere: generateBiosphereDetails(lifeType.id),
        civilization: civilizationDetails,
        spaceStations: spaceStations,
        discovered: Math.random() > 0.7 // 30% chance of being already discovered
    };
}

// Generate detailed biosphere information
function generateBiosphereDetails(lifeTypeId) {
    if (lifeTypeId === 'none') {
        return null;
    }
    
    // Basic biosphere data
    const biosphere = {
        atmosphere: getRandomAtmosphere(lifeTypeId),
        dominant_species: [],
        ecosystem_stability: Math.random() > 0.7 ? 'Stable' : 'Unstable',
        biomass: Math.floor(Math.random() * 100) + 1 // 1-100 scale
    };
    
    // Generate dominant species based on life type
    const speciesCount = {
        'microbial': 1,
        'primitive': Math.floor(Math.random() * 2) + 1,
        'complex': Math.floor(Math.random() * 3) + 2,
        'intelligent': Math.floor(Math.random() * 4) + 3,
        'advanced': Math.floor(Math.random() * 5) + 4
    };
    
    const count = speciesCount[lifeTypeId] || 0;
    
    const speciesTypes = [
        'Bacterial', 'Fungal', 'Algal', 'Plant-like', 'Insectoid', 
        'Aquatic', 'Reptilian', 'Mammalian', 'Avian', 'Hybrid'
    ];
    
    for (let i = 0; i < count; i++) {
        const speciesType = speciesTypes[Math.floor(Math.random() * speciesTypes.length)];
        const speciesAdj = ['Giant', 'Tiny', 'Bioluminescent', 'Colorful', 'Translucent', 'Armored'][Math.floor(Math.random() * 6)];
        biosphere.dominant_species.push({
            name: `${speciesAdj} ${speciesType}`,
            habitat: ['Land', 'Ocean', 'Air', 'Subterranean'][Math.floor(Math.random() * 4)],
            description: `A ${speciesAdj.toLowerCase()} ${speciesType.toLowerCase()} species adapted to this planet's conditions.`
        });
    }
    
    return biosphere;
}

// Generate random atmosphere composition
function getRandomAtmosphere(lifeTypeId) {
    let atmosphereType;
    
    if (lifeTypeId === 'none' || lifeTypeId === 'microbial') {
        atmosphereType = ['Thin CO2', 'Thick CO2', 'Nitrogen-rich', 'Sulfuric', 'Methane-rich', 'Helium-rich', 'Nearly Vacuum'][Math.floor(Math.random() * 7)];
    } else {
        // More habitable atmospheres for higher life forms
        atmosphereType = ['Nitrogen-Oxygen', 'Oxygen-rich', 'Carbon-Nitrogen', 'Methane-Ammonia', 'Oxygen-Argon'][Math.floor(Math.random() * 5)];
    }
    
    return {
        type: atmosphereType,
        pressure: Math.random() * 2.5 + 0.1, // 0.1-2.6 atmospheres
        breathable: atmosphereType === 'Nitrogen-Oxygen' || atmosphereType === 'Oxygen-rich'
    };
}

// Modify createGalaxy function to prevent stars from spawning in black holes
function createGalaxy(position, galaxyName, galaxySize, galaxyType, galaxyColor) {
    const galaxy = new THREE.Group();
    galaxy.position.copy(position);
    universe.add(galaxy);
    
    // Random rotation
    galaxy.rotation.x = Math.random() * Math.PI;
    galaxy.rotation.y = Math.random() * Math.PI;
    galaxy.rotation.z = Math.random() * Math.PI;
    
    // Add galaxy info
    galaxy.userData = {
        name: galaxyName,
        type: galaxyType,
        size: galaxySize,
        systems: []
    };
    
    // Create center black hole
    const blackHoleSize = galaxySize * 0.5;
    const blackHoleGeometry = new THREE.SphereGeometry(blackHoleSize, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0.8
    });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    galaxy.add(blackHole);
    
    // Add accretion disk
    const diskGeometry = new THREE.RingGeometry(galaxySize * 0.6, galaxySize * 1.2, 64);
    const diskMaterial = new THREE.MeshBasicMaterial({
        color: galaxyColor,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    accretionDisk.rotation.x = Math.PI / 2;
    blackHole.add(accretionDisk);
    
    // Add galaxy label
    if (document.getElementById('showLabels').checked) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'galaxy-label';
        labelDiv.textContent = galaxyName;
        const label = new THREE.CSS2DObject(labelDiv);
        label.position.set(0, galaxySize * 0.8, 0);
        label.userData = { type: 'galaxy-label' };
        galaxy.add(label);
    }
    
    // Create star systems with planets
    const starCount = 50; // Reduced count for testing
    
    for (let i = 0; i < starCount; i++) {
        // Generate star position
        let radius, x, y, z;
        let isInsideBlackHole;
        
        // Ensure stars don't spawn inside the black hole
        do {
            radius = Math.random() * galaxySize * 10;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * galaxySize;
            
            x = Math.cos(angle) * radius;
            y = height;
            z = Math.sin(angle) * radius;
            
            // Check if inside black hole or too close to it
            // Using realistic proportions - black holes have intense gravitational effects
            // that would prevent stable star systems from forming too close
            const distanceFromCenter = Math.sqrt(x*x + y*y + z*z);
            
            // Realistic minimum safe distance is at least 5x the black hole size
            // Black holes exert strong tidal forces that would disrupt star systems
            isInsideBlackHole = distanceFromCenter < (blackHoleSize * 5.0);
            
        } while (isInsideBlackHole);
        
        const starClass = getRandomStarClass();
        const systemSize = (0.1 + (starClass.mass / 50)) * galaxySize * 0.2;
        const systemPosition = new THREE.Vector3(x, y, z);
        const systemName = `${galaxyName.charAt(0)}${galaxyName.charAt(1)}-${starClass.type}${Math.floor(Math.random() * 1000)}`;
        
        // Create star system
        const starSystem = new THREE.Group();
        starSystem.position.copy(systemPosition);
        galaxy.add(starSystem);
        
        // Create star
        const starGeometry = new THREE.SphereGeometry(systemSize, 16, 16);
        const starMaterial = new THREE.MeshBasicMaterial({ color: starClass.color });
        const star = new THREE.Mesh(starGeometry, starMaterial);
        starSystem.add(star);
        
        // Add simple glow
        const starGlow = new THREE.PointLight(starClass.color, 0.5, galaxySize * 2);
        star.add(starGlow);
        
        // Determine planet count (1-8)
        const planetCount = Math.floor(Math.random() * 8) + 1;
        
        // Determine habitable zone
        const habitableZoneInner = Math.sqrt(starClass.luminosity) * 0.75; // AU
        const habitableZoneOuter = Math.sqrt(starClass.luminosity) * 1.5; // AU
        
        // Track habitable planets
        let habitablePlanets = 0;
        
        // Create planets with proper orbits
        for (let j = 0; j < planetCount; j++) {
            // Determine orbit distance - spacing increases with distance from star
            // Ensure planets start at a minimum safe distance from the star surface
            const minSafeDistance = systemSize * 2; // Minimum distance from star center (2x star radius)
            const orbitDistance = minSafeDistance + systemSize * (2 + j * 3); // More spacing between planets
            
            // Check if in habitable zone
            const inHabitableZone = (orbitDistance >= systemSize * habitableZoneInner && 
                                    orbitDistance <= systemSize * habitableZoneOuter);
            
            // Add asteroid belt at random position (usually between inner and outer planets)
            if ((j === 2 || j === 3) && Math.random() > 0.6) {
                const asteroidBeltDistance = orbitDistance + systemSize * 0.5;
                const asteroidBeltWidth = systemSize * 1.5;
                
                // Create asteroid belt visualization
                const asteroidBeltGeometry = new THREE.RingGeometry(
                    asteroidBeltDistance - asteroidBeltWidth/2, 
                    asteroidBeltDistance + asteroidBeltWidth/2, 
                    64
                );
                const asteroidBeltMaterial = new THREE.MeshBasicMaterial({
                    color: 0x8B7355,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
                const asteroidBelt = new THREE.Mesh(asteroidBeltGeometry, asteroidBeltMaterial);
                asteroidBelt.rotation.x = Math.random() * Math.PI / 2;
                starSystem.add(asteroidBelt);
                
                // Add individual asteroids
                const asteroidCount = Math.floor(Math.random() * 30) + 20;
                const asteroidGroup = new THREE.Group();
                asteroidGroup.userData = {
                    type: 'asteroid-belt',
                    rotationSpeed: 0.001 * (Math.random() * 0.5 + 0.75)
                };
                starSystem.add(asteroidGroup);
                
                for (let a = 0; a < asteroidCount; a++) {
                    // Random position within belt
                    const asteroidDistance = asteroidBeltDistance + (Math.random() - 0.5) * asteroidBeltWidth;
                    const asteroidAngle = Math.random() * Math.PI * 2;
                    const asteroidElevation = (Math.random() - 0.5) * systemSize * 0.2;
                    
                    const asteroidSize = systemSize * (0.02 + Math.random() * 0.05);
                    
                    // Create irregular asteroid shape
                    const asteroidDetail = Math.floor(Math.random() * 2) + 2;
                    const asteroidGeometry = new THREE.DodecahedronGeometry(asteroidSize, asteroidDetail);
                    
                    // Distort the geometry to make it more irregular
                    const asteroidPositions = asteroidGeometry.attributes.position;
                    for (let i = 0; i < asteroidPositions.count; i++) {
                        const x = asteroidPositions.getX(i);
                        const y = asteroidPositions.getY(i);
                        const z = asteroidPositions.getZ(i);
                        
                        const noise = Math.random() * 0.3 + 0.7;
                        asteroidPositions.setXYZ(i, x * noise, y * noise, z * noise);
                    }
                    
                    const asteroidMaterial = new THREE.MeshBasicMaterial({
                        color: Math.random() > 0.5 ? 0x8B7355 : 0x9C9C9C,
                        wireframe: Math.random() > 0.8
                    });
                    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
                    
                    // Position asteroid
                    asteroid.position.set(
                        Math.cos(asteroidAngle) * asteroidDistance,
                        asteroidElevation,
                        Math.sin(asteroidAngle) * asteroidDistance
                    );
                    
                    // Random rotation
                    asteroid.rotation.x = Math.random() * Math.PI;
                    asteroid.rotation.y = Math.random() * Math.PI;
                    asteroid.rotation.z = Math.random() * Math.PI;
                    
                    // Add to asteroid group
                    asteroidGroup.add(asteroid);
                }
            }
            
            // Planet size (gas giants are bigger than rocky planets)
            const isGasGiant = j > 3 || (j > 2 && Math.random() > 0.7);
            const planetSize = isGasGiant ? 
                systemSize * (0.3 + Math.random() * 0.2) : 
                systemSize * (0.1 + Math.random() * 0.1);
            
            // Planet color based on type
            let planetColor;
            let planetType = '';
            
            if (isGasGiant) {
                if (Math.random() > 0.7) {
                    // Gas giant types
                    if (Math.random() > 0.5) {
                        planetColor = blendColors(0xffaa44, 0xffcc88, Math.random()); // Jupiter-like
                        planetType = 'Jupiter-like Gas Giant';
                    } else {
                        planetColor = blendColors(0xeebb77, 0xddaa66, Math.random()); // Saturn-like
                        planetType = 'Saturn-like Gas Giant';
                    }
                } else {
                    if (Math.random() > 0.5) {
                        planetColor = blendColors(0x44aaff, 0x44ffcc, Math.random());  // Neptune-like
                        planetType = 'Ice Giant';
                    } else {
                        planetColor = blendColors(0x77aaff, 0x77ccff, Math.random());  // Uranus-like
                        planetType = 'Ice Giant';
                    }
                }
            } else if (inHabitableZone) {
                if (Math.random() > 0.3) {
                    planetColor = blendColors(0x2255aa, 0x338855, Math.random()); // Earth-like
                    planetType = 'Habitable Terrestrial';
                } else {
                    planetColor = blendColors(0xaa6633, 0x774422, Math.random()); // Mars-like
                    planetType = 'Dry Terrestrial';
                }
                habitablePlanets++;
            } else if (j < 2) {
                // Inner planets
                if (Math.random() > 0.5) {
                    planetColor = blendColors(0xaa5522, 0x553322, Math.random()); // Mercury-like
                    planetType = 'Rocky Inner Planet';
                } else {
                    planetColor = blendColors(0xddbb77, 0xffcc44, Math.random()); // Venus-like
                    planetType = 'Greenhouse Inner Planet';
                }
            } else {
                // Outer rocky planets
                planetColor = blendColors(0x888888, 0xaaaaaa, Math.random());  // Cold rocky
                planetType = 'Frozen Outer Planet';
            }
            
            // Create orbit visualization
            const orbitShape = new THREE.EllipseCurve(
                0, 0,                                  // Center x, y
                orbitDistance, orbitDistance,          // xRadius, yRadius
                0, 2 * Math.PI,                        // Start angle, end angle
                false,                                 // Clockwise
                0                                      // Rotation
            );
            
            const orbitPoints = orbitShape.getPoints(64);
            const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            
            // Blue for habitable zone, white for other orbits
            const orbitMaterial = new THREE.LineBasicMaterial({
                color: inHabitableZone ? 0x00ff00 : 0xffffff,
                transparent: true,
                opacity: 0.5
            });
            
            const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
            orbitLine.rotation.x = Math.PI / 2;
            orbitLine.userData = { type: 'planet-orbit-line' };
            
            starSystem.add(orbitLine);
            
            // Create planet group for orbit
            const planetGroup = new THREE.Group();
            starSystem.add(planetGroup);
            
            // Create planet
            const planetGeometry = new THREE.SphereGeometry(planetSize, 16, 16);
            const planetMaterial = new THREE.MeshBasicMaterial({ color: planetColor });
            const planet = new THREE.Mesh(planetGeometry, planetMaterial);
            
            // Add surface features for some planets
            if (!isGasGiant && Math.random() > 0.5) {
                // Add craters or surface features
                const featureCount = Math.floor(Math.random() * 5) + 1;
                for (let f = 0; f < featureCount; f++) {
                    const featureSize = planetSize * (0.05 + Math.random() * 0.15);
                    const featureGeometry = new THREE.CircleGeometry(featureSize, 8);
                    const featureMaterial = new THREE.MeshBasicMaterial({ 
                        color: blendColors(planetColor, 0x000000, 0.3),
                        side: THREE.DoubleSide
                    });
                    const feature = new THREE.Mesh(featureGeometry, featureMaterial);
                    
                    // Position on surface of planet
                    const phi = Math.acos(2 * Math.random() - 1);
                    const theta = Math.random() * Math.PI * 2;
                    
                    feature.position.setFromSphericalCoords(planetSize * 1.001, phi, theta);
                    feature.lookAt(0, 0, 0);
                    
                    planet.add(feature);
                }
            }
            
            // Add rings to some gas giants
            const hasRings = isGasGiant && Math.random() > 0.7;
            if (hasRings) {
                const ringInnerRadius = planetSize * 1.05;
                const ringOuterRadius = planetSize * 1.15;
                const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: blendColors(planetColor, 0xffffff, 0.5),
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.rotation.x = Math.PI / 2;
                planet.add(ring);
            }
            
            // Position planet on orbit with random starting position
            const startAngle = Math.random() * Math.PI * 2;
            planetGroup.rotation.y = startAngle;
            planet.position.x = orbitDistance;
            planetGroup.add(planet);
            
            // Generate planet name
            const planetName = `${systemName}-${String.fromCharCode(98 + j)}`; // Using a, b, c, etc.
            
            // Generate life information if in habitable zone or by random chance
            const lifeDetails = generateLifeDetails(planetType, inHabitableZone);
            
            // Generate planet characteristics
            const planetData = {
                name: planetName,
                index: j,
                isGasGiant: isGasGiant,
                inHabitableZone: inHabitableZone,
                orbitDistance: orbitDistance,
                size: planetSize,
                color: planetColor,
                type: planetType,
                surfaceTemp: inHabitableZone ? 
                    Math.floor(Math.random() * 50) + 240 : // 240-290K for habitable
                    (j < 2 ? 
                        Math.floor(Math.random() * 300) + 300 : // 300-600K for inner planets
                        Math.floor(Math.random() * 150) + 50),  // 50-200K for outer planets
                gravity: (planetSize / (systemSize * 0.2)) * (isGasGiant ? 2.5 : 1), // Relative to Earth
                day_length: Math.floor(Math.random() * 36) + 6, // 6-42 hour days
                year_length: Math.floor(orbitDistance * 10), // Orbital period in Earth days
                has_rings: hasRings,
                moons: [], // Will be filled later
                life: lifeDetails
            };
            
            // Add space stations if the planet has them in the life data
            if (lifeDetails && lifeDetails.spaceStations && lifeDetails.spaceStations.length > 0) {
                // Add each space station as a 3D object in orbit
                lifeDetails.spaceStations.forEach((station, index) => {
                    // Create station orbit group
                    const stationOrbitGroup = new THREE.Group();
                    planetGroup.add(stationOrbitGroup);
                    
                    // Create station orbit path
                    const stationOrbitDistance = planetSize * (2.0 + index * 0.7); // Increasing orbit distances
                    
                    // Create orbit visualization for station
                    const stationOrbitShape = new THREE.EllipseCurve(
                        0, 0,                                  // Center x, y
                        stationOrbitDistance, stationOrbitDistance,  // xRadius, yRadius
                        0, 2 * Math.PI,                        // Start angle, end angle
                        false,                                 // Clockwise
                        0                                      // Rotation
                    );
                    
                    const stationOrbitPoints = stationOrbitShape.getPoints(32);
                    const stationOrbitGeometry = new THREE.BufferGeometry().setFromPoints(stationOrbitPoints);
                    const stationOrbitMaterial = new THREE.LineBasicMaterial({
                        color: 0x66ccff,
                        transparent: true,
                        opacity: 0.4
                    });
                    
                    const stationOrbitLine = new THREE.Line(stationOrbitGeometry, stationOrbitMaterial);
                    stationOrbitLine.rotation.x = Math.PI / 2;
                    stationOrbitLine.userData = { type: 'station-orbit-line' };
                    stationOrbitGroup.add(stationOrbitLine);
                    
                    // Create the station with proper scaling
                    const stationModel = createSpaceStation(station.id, planetSize);
                    stationModel.userData = {
                        type: 'space-station',
                        name: station.name,
                        description: station.description,
                        size: station.size,
                        population: station.population,
                        established: station.established,
                        station_id: station.id
                    };
                    
                    // Position station along orbit with random angle offset from planet
                    const stationAngle = Math.random() * Math.PI * 2;
                    stationOrbitGroup.rotation.y = stationAngle;
                    stationModel.position.x = stationOrbitDistance;
                    
                    // Slightly tilt station orbit relative to planet orbit
                    stationOrbitGroup.rotation.x = (Math.random() - 0.5) * 0.2;
                    stationOrbitGroup.rotation.z = (Math.random() - 0.5) * 0.2;
                    
                    // Add to orbit group
                    stationOrbitGroup.add(stationModel);
                    
                    // Add orbit data
                    stationOrbitGroup.userData = {
                        type: 'station-orbit',
                        stationName: station.name,
                        rotationSpeed: 0.005 + Math.random() * 0.005, // Faster than planets, slower than moons
                        station_type: station.id
                    };
                });
            }
            
            // Add moons to some planets (more for gas giants)
            let moons = [];
            if (isGasGiant || Math.random() > 0.7) {
                const moonCount = isGasGiant ? Math.floor(Math.random() * 4) + 1 : 1;
                
                for (let k = 0; k < moonCount; k++) {
                    const moonSize = planetSize * 0.2;
                    const moonDistance = planetSize * 2.5;
                    const moonGeometry = new THREE.SphereGeometry(moonSize, 8, 8);
                    const moonMaterial = new THREE.MeshBasicMaterial({ 
                        color: blendColors(0xaaaaaa, 0x888888, Math.random())
                    });
                    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
                    
                    // Add craters to moons
                    if (Math.random() > 0.6) {
                        const craterCount = Math.floor(Math.random() * 3) + 1;
                        for (let c = 0; c < craterCount; c++) {
                            const craterSize = moonSize * (0.1 + Math.random() * 0.2);
                            const craterGeometry = new THREE.CircleGeometry(craterSize, 8);
                            const craterMaterial = new THREE.MeshBasicMaterial({ 
                                color: 0x555555,
                                side: THREE.DoubleSide
                            });
                            const crater = new THREE.Mesh(craterGeometry, craterMaterial);
                            
                            // Position on surface of moon
                            const phi = Math.acos(2 * Math.random() - 1);
                            const theta = Math.random() * Math.PI * 2;
                            
                            crater.position.setFromSphericalCoords(moonSize * 1.001, phi, theta);
                            crater.lookAt(0, 0, 0);
                            
                            moon.add(crater);
                        }
                    }
                    
                    const moonGroup = new THREE.Group();
                    planetGroup.add(moonGroup);
                    
                    // Draw moon orbit line
                    const moonOrbitShape = new THREE.EllipseCurve(
                        0, 0,                         // Center x, y
                        moonDistance, moonDistance,   // xRadius, yRadius
                        0, 2 * Math.PI,               // Start angle, end angle
                        false,                        // Clockwise
                        0                             // Rotation
                    );
                    
                    const moonOrbitPoints = moonOrbitShape.getPoints(32);
                    const moonOrbitGeometry = new THREE.BufferGeometry().setFromPoints(moonOrbitPoints);
                    const moonOrbitMaterial = new THREE.LineBasicMaterial({
                        color: 0xaaaaaa,
                        transparent: true,
                        opacity: 0.5
                    });
                    
                    const moonOrbitLine = new THREE.Line(moonOrbitGeometry, moonOrbitMaterial);
                    moonOrbitLine.rotation.x = Math.PI / 2;
                    moonOrbitLine.userData = { type: 'moon-orbit-line' };
                    moonGroup.add(moonOrbitLine);
                    
                    moon.position.x = moonDistance;
                    moonGroup.add(moon);
                    
                    // Random moon orbit angle
                    moonGroup.rotation.y = Math.random() * Math.PI * 2;
                    moonGroup.rotation.x = Math.random() * Math.PI / 4;
                    
                    // Add moon orbit data
                    const moonName = `${planetName}-${k+1}`;
                    moonGroup.userData = {
                        type: 'moon-orbit',
                        rotationSpeed: 0.02,
                        name: moonName,
                        radius: moonSize
                    };
                    
                    const moonData = {
                        name: moonName,
                        size: moonSize,
                        // Generate some simple life data for moons too (much rarer)
                        life: Math.random() > 0.95 ? generateLifeDetails('Moon', false) : { ...LIFE_TYPES[0] }
                    };
                    
                    moons.push(moonData);
                    planetData.moons.push(moonData);
                }
            }
            
            // Add planet orbit data with all metadata
            planetGroup.userData = {
                type: 'planet-orbit',
                rotationSpeed: 0.002 / (j + 1), // Outer planets move slower
                planetIndex: j,
                name: planetName,
                isGasGiant: isGasGiant,
                inHabitableZone: inHabitableZone,
                orbitDistance: orbitDistance,
                size: planetSize,
                color: planetColor,
                moons: planetData.moons,
                planetType: planetType,
                surfaceTemp: planetData.surfaceTemp,
                gravity: planetData.gravity,
                day_length: planetData.day_length,
                year_length: planetData.year_length,
                has_rings: planetData.has_rings,
                life: planetData.life
            };
        }
        
        // Add star system data
        starSystem.userData = {
            name: systemName,
            type: starClass.type,
            spectralClass: `${starClass.type}-class star`,
            temperature: starClass.temp,
            mass: starClass.mass,
            luminosity: starClass.luminosity,
            planets: planetCount,
            habitablePlanets: habitablePlanets,
            age: Math.floor(Math.random() * 10) + 1 + ' billion years',
            color: starClass.color,
            radius: systemSize,
            systemType: 'star-system'
        };
        
        // Add label to star system
        if (document.getElementById('showLabels').checked) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'system-label';
            labelDiv.textContent = systemName;
            if (habitablePlanets > 0) {
                labelDiv.classList.add('habitable');
            }
            const label = new THREE.CSS2DObject(labelDiv);
            label.position.set(0, systemSize * 2, 0);
            label.userData = { type: 'system-label' };
            starSystem.add(label);
        }
        
        // Store system info
        galaxy.userData.systems.push({
            mesh: starSystem,
            name: systemName,
            position: systemPosition.clone(),
            habitablePlanets: habitablePlanets
        });
    }
    
    return galaxy;
}

// Generate universe with galaxies
function generateUniverse() {
    // First, remove all CSS2D objects from the scene that might be lingering
    // This prevents text labels from old universes staying on screen
    const objectsToRemove = [];
    scene.traverse(object => {
        if (object instanceof THREE.CSS2DObject) {
            objectsToRemove.push(object);
        }
    });
    
    // Remove all found CSS2D objects
    objectsToRemove.forEach(object => {
        if (object.parent) {
            object.parent.remove(object);
        }
    });
    
    // Clear any remaining detail panels
    const detailContainers = [
        document.getElementById('planetDetailContainer'),
        document.getElementById('systemDetailContainer'),
        document.getElementById('stationDetailContainer')
    ];
    
    detailContainers.forEach(container => {
        if (container) {
            document.body.removeChild(container);
        }
    });
    
    // Clear existing universe
    while (universe.children.length > 0) {
        const object = universe.children[0];
        
        // Properly dispose of any materials and geometries
        if (object.traverse) {
            object.traverse(child => {
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                
                if (child.geometry) {
                    child.geometry.dispose();
                }
            });
        }
        
        universe.remove(object);
    }
    
    galaxies = [];
    
    // Get settings from UI
    const galaxyCount = parseInt(document.getElementById('galaxyCount').value);
    
    // Galaxy naming
    const galaxyNamePrefix = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    const galaxyNameSuffix = ['Prime', 'Major', 'Minor', 'Centauri', 'Proxima'];
    
    // Create galaxies
    for (let i = 0; i < galaxyCount; i++) {
        const spread = 4000;
        let position;
        const galaxySize = 50 + Math.random() * 100;
        let validPosition = false;
        
        // Try up to 10 times to find a valid position with no collisions
        let attempts = 0;
        while (!validPosition && attempts < 10) {
            position = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread * 0.5,
                (Math.random() - 0.5) * spread
            );
            
            // Check distance to existing galaxies
            validPosition = true;
            for (let j = 0; j < galaxies.length; j++) {
                const existingGalaxy = galaxies[j];
                const existingGalaxySize = existingGalaxy.userData.size;
                const minSafeDistance = galaxySize + existingGalaxySize + 200; // Add 200 units buffer
                
                const distance = position.distanceTo(existingGalaxy.position);
                if (distance < minSafeDistance) {
                    validPosition = false;
                    break;
                }
            }
            
            attempts++;
        }
        
        // If we couldn't find a valid position after max attempts, adjust the position to be safe
        if (!validPosition && galaxies.length > 0) {
            const referenceGalaxy = galaxies[0];
            position = new THREE.Vector3().copy(referenceGalaxy.position);
            
            // Move away in a random direction
            const randomDir = new THREE.Vector3(
                Math.random() - 0.5,
                (Math.random() - 0.5) * 0.5,
                Math.random() - 0.5
            ).normalize();
            
            const minSafeDistance = galaxySize + referenceGalaxy.userData.size + 500;
            position.add(randomDir.multiplyScalar(minSafeDistance));
        }
        
        const galaxyType = Math.random() > 0.5 ? 'spiral' : 'elliptical';
        const galaxyColor = getRandomColor();
        
        // Generate name
        const prefixIndex = Math.floor(Math.random() * galaxyNamePrefix.length);
        const suffixIndex = Math.floor(Math.random() * galaxyNameSuffix.length);
        const galaxyName = `${galaxyNamePrefix[prefixIndex]} ${galaxyNameSuffix[suffixIndex]}`;
        
        const galaxy = createGalaxy(position, galaxyName, galaxySize, galaxyType, galaxyColor);
        // Store the galaxy size for future collision detection
        galaxy.userData.size = galaxySize;
        galaxies.push(galaxy);
    }
    
    // Reset camera position
    camera.position.set(0, 2000, 0);
    camera.lookAt(0, 0, 0);
    
    // Update UI
    document.getElementById('locationInfo').textContent = 'Universe Overview';
    
    currentView = 'universe';
    currentSystem = null;
    
    // Force a complete refresh of the label renderer to clear any lingering labels
    labelRenderer.domElement.innerHTML = '';
}

// Add key event listeners for speed boost
let speedMultiplier = 1;
document.addEventListener('keydown', function(event) {
    // Check if shift key is pressed
    if (event.key === 'Shift') {
        // Boost speed
        speedMultiplier = 10; // Increased from 5 to 10 for much faster movement
        
        if (activeControls === 'fly') {
            flyControls.movementSpeed = 100 * speedMultiplier;
        } else {
            orbitControls.panSpeed = 1.5 * speedMultiplier;
            orbitControls.rotateSpeed = 1.5 * speedMultiplier;
            orbitControls.zoomSpeed = 1.5 * speedMultiplier;
        }
    }
});

document.addEventListener('keyup', function(event) {
    // Check if shift key is released
    if (event.key === 'Shift') {
        // Reset speed
        speedMultiplier = 1;
        
        if (activeControls === 'fly') {
            flyControls.movementSpeed = 100;
        } else {
            orbitControls.panSpeed = 1.5;
            orbitControls.rotateSpeed = 1.5;
            orbitControls.zoomSpeed = 1.5;
        }
    }
});

// Add debug stats panel
function initializeDebugPanel() {
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debugPanel';
    debugContainer.innerHTML = `
        <div class="debug-content">
            <div id="fpsCounter">FPS: --</div>
            <div id="statsCounter">
                Stars: -- | Planets: -- | Moons: --
            </div>
            <div id="statsCounter2">
                Asteroids: -- | Galaxies: --
            </div>
            <div id="cameraPos">
                Pos: (--,--,--)
            </div>
        </div>
    `;
    document.body.appendChild(debugContainer);
}

// Update debug stats
function updateDebugStats(fps) {
    // Update FPS
    document.getElementById('fpsCounter').textContent = `FPS: ${fps.toFixed(1)}`;
    
    // Count objects
    let galaxyCount = 0;
    let starCount = 0;
    let planetCount = 0;
    let moonCount = 0;
    let asteroidCount = 0;
    
    universe.children.forEach(galaxy => {
        galaxyCount++;
        
        galaxy.children.forEach(child => {
            if (child.userData && child.userData.systemType === 'star-system') {
                starCount++;
                
                child.children.forEach(systemChild => {
                    if (systemChild.userData && systemChild.userData.type === 'planet-orbit') {
                        planetCount++;
                        
                        systemChild.children.forEach(planetChild => {
                            if (planetChild.userData && planetChild.userData.type === 'moon-orbit') {
                                moonCount++;
                            }
                        });
                    } else if (systemChild.userData && systemChild.userData.type === 'asteroid-belt') {
                        asteroidCount += systemChild.children.length;
                    }
                });
            }
        });
    });
    
    // Update stats counter
    document.getElementById('statsCounter').textContent = 
        `Stars: ${starCount} | Planets: ${planetCount} | Moons: ${moonCount}`;
    document.getElementById('statsCounter2').textContent = 
        `Asteroids: ${asteroidCount} | Galaxies: ${galaxyCount}`;
    
    // Update camera position
    document.getElementById('cameraPos').textContent = 
        `Pos: (${camera.position.x.toFixed(0)},${camera.position.y.toFixed(0)},${camera.position.z.toFixed(0)})`;
}

// Modified animation function for better performance
function animate() {
    requestAnimationFrame(animate);
    
    try {
        const delta = clock.getDelta();
        const fps = 1 / delta;
        
        // Update debug stats only every 10 frames for better performance
        if (Math.floor(fps) % 10 === 0) {
            updateDebugStats(fps);
        }
        
        if (activeControls === 'fly') {
            flyControls.update(delta);
        } else {
            orbitControls.update();
        }
        
        // Update location info
        document.getElementById('locationInfo').textContent = currentView === 'universe' ? 
            'Universe Overview' : 
            `Exploring ${currentSystem ? currentSystem.userData.name : 'unknown region'}`;
        
        // Find objects in the scene with isBackgroundStars flag and reposition them to follow camera
        scene.children.forEach(obj => {
            if (obj.userData && obj.userData.isBackgroundStars) {
                obj.position.copy(camera.position);
            }
        });
        
        // Performance optimization: Only render what's needed based on camera distance
        universe.children.forEach(galaxy => {
            galaxy.rotation.y += 0.0001;
            
            // Calculate distance to camera for this galaxy
            const galaxyWorldPos = new THREE.Vector3();
            galaxy.getWorldPosition(galaxyWorldPos);
            const galaxyDistToCamera = camera.position.distanceTo(galaxyWorldPos);
            
            // Only process galaxies that are reasonably close to the camera
            const isGalaxyVisible = galaxyDistToCamera < 10000;
            
            // Update all children visibility based on galaxy visibility
            galaxy.traverse(child => {
                if (child.type === 'Mesh') {
                    // Only make visible if the galaxy is within view distance
                    child.visible = isGalaxyVisible;
                }
            });
            
            // Show/hide galaxy labels based on distance
            galaxy.children.forEach(label => {
                if (label instanceof THREE.CSS2DObject && label.userData && label.userData.type === 'galaxy-label') {
                    // Only show galaxy labels when far enough away (1000-5000 units)
                    label.element.style.display = 
                        (galaxyDistToCamera > 1000 && galaxyDistToCamera < 5000 && isGalaxyVisible) ? 'block' : 'none';
                }
            });
            
            // Animate only visible galaxies
            if (isGalaxyVisible) {
                // Animate planets and asteroids in star systems
                galaxy.children.forEach(child => {
                    if (child.userData && child.userData.systemType === 'star-system') {
                        // Calculate distance to camera to optimize rendering
                        const worldPos = new THREE.Vector3();
                        child.getWorldPosition(worldPos);
                        const distToCamera = camera.position.distanceTo(worldPos);
                        
                        // Optimize performance by only processing nearby systems
                        const isSystemClose = distToCamera < 1000;
                        
                        // Toggle visibility of system components based on distance
                        child.traverse(obj => {
                            if (obj !== child && obj.type === 'Mesh') {
                                obj.visible = isSystemClose;
                            }
                        });
                        
                        // Only animate systems that are close enough to be visible
                        if (isSystemClose) {
                            // Find all planet orbit groups and rotate them
                            child.children.forEach(systemChild => {
                                if (systemChild.userData && systemChild.userData.type === 'planet-orbit') {
                                    systemChild.rotation.y += systemChild.userData.rotationSpeed;
                                    
                                    // Also rotate moons if they exist
                                    systemChild.children.forEach(planetChild => {
                                        if (planetChild.userData && planetChild.userData.type === 'moon-orbit') {
                                            planetChild.rotation.y += planetChild.userData.rotationSpeed;
                                        }
                                        
                                        // Animate space station orbits
                                        if (planetChild.userData && planetChild.userData.type === 'station-orbit') {
                                            planetChild.rotation.y += planetChild.userData.rotationSpeed;
                                            
                                            // Add a slight wobble to stations
                                            planetChild.children.forEach(stationChild => {
                                                if (stationChild.userData && stationChild.userData.type === 'space-station') {
                                                    stationChild.rotation.x += 0.001 * Math.sin(Date.now() * 0.001);
                                                    stationChild.rotation.z += 0.0005 * Math.cos(Date.now() * 0.0015);
                                                }
                                            });
                                        }
                                    });
                                } else if (systemChild.userData && systemChild.userData.type === 'asteroid-belt') {
                                    // Rotate asteroid belt
                                    systemChild.rotation.y += systemChild.userData.rotationSpeed;
                                    
                                    // Add slight wobble to asteroids - but only process some each frame for performance
                                    if (Math.random() > 0.8) {
                                        const asteroidCount = systemChild.children.length;
                                        // Only process a subset of asteroids each frame
                                        const processCount = Math.min(5, asteroidCount);
                                        for (let i = 0; i < processCount; i++) {
                                            const asteroidIndex = Math.floor(Math.random() * asteroidCount);
                                            if (systemChild.children[asteroidIndex]) {
                                                const asteroid = systemChild.children[asteroidIndex];
                                                asteroid.rotation.x += 0.002 * Math.random();
                                                asteroid.rotation.y += 0.002 * Math.random();
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        
                        // Show/hide star system labels based on distance
                        child.children.forEach(label => {
                            if (label instanceof THREE.CSS2DObject && label.userData && label.userData.type === 'system-label') {
                                // Only show system labels when close (50-500 units)
                                // Hide when too close or too far
                                label.element.style.display = 
                                    (distToCamera > 50 && distToCamera < 500 && isSystemClose) ? 'block' : 'none';
                            }
                        });
                    }
                });
            }
        });
        
        // Show nearby system info in info panel - optimize by only updating periodically
        if (Math.random() > 0.9) { // Only update 10% of frames
            let closestSystem = null;
            let closestDistance = Infinity;
            
            // Find closest star system
            universe.children.forEach(galaxy => {
                galaxy.children.forEach(child => {
                    if (child.userData && child.userData.systemType === 'star-system') {
                        const worldPos = new THREE.Vector3();
                        child.getWorldPosition(worldPos);
                        const distToCamera = camera.position.distanceTo(worldPos);
                        
                        if (distToCamera < closestDistance && distToCamera < 300) {
                            closestSystem = child;
                            closestDistance = distToCamera;
                        }
                    }
                });
            });
            
            // Update nearby info panel
            if (closestSystem) {
                const info = closestSystem.userData;
                let htmlContent = `<strong>Nearby Star System: ${info.name}</strong><br>`;
                htmlContent += `Type: ${info.spectralClass}<br>`;
                htmlContent += `Planets: ${info.planets}<br>`;
                if (info.habitablePlanets > 0) {
                    htmlContent += `<span class="habitable-indicator"></span> Habitable planets: ${info.habitablePlanets}<br>`;
                }
                htmlContent += `Age: ${info.age}<br>`;
                htmlContent += `Distance: ${Math.round(closestDistance)} units`;
                
                document.getElementById('nearbyInfo').innerHTML = htmlContent;
                currentSystem = closestSystem;
            } else {
                document.getElementById('nearbyInfo').innerHTML = '';
                currentSystem = null;
            }
        }
        
        // Render the scene
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    } catch (error) {
        console.error("Animation error:", error);
    }
}

// Initialize the universe with the fixed background stars
const backgroundStars = createStarBackground();
generateUniverse();
initializeDebugPanel();

// Toggle between orbit and fly controls
document.getElementById('toggleView').addEventListener('click', function() {
    if (activeControls === 'orbit') {
        activeControls = 'fly';
        orbitControls.enabled = false;
        flyControls.enabled = true;
    } else {
        activeControls = 'orbit';
        flyControls.enabled = false;
        orbitControls.enabled = true;
    }
});

// Generate new universe button
document.getElementById('generateNew').addEventListener('click', function() {
    generateUniverse();
});

// Update slider labels
document.getElementById('galaxyCount').addEventListener('input', function(e) {
    document.getElementById('galaxyCountValue').textContent = e.target.value;
});

document.getElementById('density').addEventListener('input', function(e) {
    document.getElementById('densityValue').textContent = e.target.value;
});

document.getElementById('orbitVisibility').addEventListener('input', function(e) {
    const value = e.target.value;
    document.getElementById('orbitVisibilityValue').textContent = value;
    updateOrbitLineVisibility(value / 10); // Convert 0-10 to 0-1 for opacity
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();

// Add event listener for mouse clicks to handle star system selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Find all intersected objects
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Check for star system or planet clicks
    for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        
        // Check if we clicked on a planet
        let planetObject = null;
        let systemObject = null;
        let stationObject = null;
        
        // Traverse up to find parent with planet data
        let currentObj = object;
        
        while (currentObj && !planetObject && !stationObject) {
            // Check for planet
            if (currentObj.parent && currentObj.parent.userData && 
                currentObj.parent.userData.type === 'planet-orbit') {
                planetObject = currentObj.parent;
            }
            
            // Check for station
            if (currentObj.userData && currentObj.userData.type === 'space-station') {
                stationObject = currentObj;
                
                // Find the planet this station belongs to
                let parent = currentObj.parent; // Station orbit group
                while (parent) {
                    if (parent.userData && parent.userData.type === 'planet-orbit') {
                        planetObject = parent;
                        break;
                    }
                    parent = parent.parent;
                }
            }
            
            // Move up the hierarchy
            currentObj = currentObj.parent;
        }
        
        // Find the star system this planet belongs to
        if (planetObject) {
            let parent = planetObject.parent;
            while (parent) {
                if (parent.userData && parent.userData.systemType === 'star-system') {
                    systemObject = parent;
                    break;
                }
                parent = parent.parent;
            }
        }
        
        // If we found a planet and its system, show details
        if (planetObject && systemObject) {
            if (stationObject) {
                // Show station details along with planet
                showStationDetail(stationObject, planetObject, systemObject);
            } else {
                // Show normal planet details
                showPlanetDetail(planetObject, systemObject);
            }
            return; // Stop processing after finding a valid object
        }
        
        // Check if we clicked on a star system
        if (object.parent && object.parent.userData && 
            object.parent.userData.systemType === 'star-system') {
            showStarSystemDetail(object.parent);
            return; // Stop processing after finding a valid object
        }
    }
}

// Function to display detailed view of a planet
function showPlanetDetail(planetObject, starSystem) {
    // Store current system for reference
    currentSystem = starSystem;
    currentView = 'planet';
    
    const planetData = planetObject.userData;
    const systemData = starSystem.userData;
    
    // Create detailed information HTML
    let detailHTML = `
        <div id="planetDetailOverlay">
            <div id="planetDetailPanel">
                <div class="detail-header">
                    <h2>${planetData.name}</h2>
                    <button id="closeDetailView" class="close-button" title="Close">×</button>
                </div>
                <div class="planet-stats">
                    <div class="stat-column">
                        <h3>Planet Information</h3>
                        <p>Type: ${planetData.type}</p>
                        <p>Size: ${(planetData.size / (systemData.radius * 0.1)).toFixed(2)} Earth radii</p>
                        <p>Gravity: ${planetData.gravity.toFixed(2)}g</p>
                        <p>Distance from star: ${(planetData.orbitDistance / (systemData.radius * 3)).toFixed(2)} AU</p>
                        <p>Surface temperature: ${planetData.surfaceTemp}K</p>
                        <p>Day length: ${planetData.day_length} hours</p>
                        <p>Year length: ${planetData.year_length} days</p>
                        <p>Orbital period: ${calculateOrbitalPeriod(planetData.orbitDistance, systemData.mass).toFixed(2)} years</p>
                        ${planetData.has_rings ? '<p>Has ring system</p>' : ''}
                        <p>Moons: ${planetData.moons.length}</p>
                    </div>
                    <div class="stat-column">
                        <h3>Life Detection</h3>
                        ${generateLifeHTML(planetData.life)}
                    </div>
                </div>
                ${planetData.life && planetData.life.id !== 'none' ? generateBiosphereHTML(planetData.life) : ''}
                ${planetData.life && planetData.life.civilization ? generateCivilizationHTML(planetData.life) : ''}
                ${planetData.life && planetData.life.spaceStations && planetData.life.spaceStations.length > 0 ? 
                  generateSpaceStationsHTML(planetData.life.spaceStations) : ''}
            </div>
        </div>
    `;
    
    // Remove any existing detail container first to prevent duplicates
    const existingDetailContainer = document.getElementById('planetDetailContainer');
    if (existingDetailContainer) {
        document.body.removeChild(existingDetailContainer);
    }
    
    // Create a new detail container
    const detailContainer = document.createElement('div');
    detailContainer.id = 'planetDetailContainer';
    document.body.appendChild(detailContainer);
    
    // Add the HTML to the container
    detailContainer.innerHTML = detailHTML;
    
    // Add styling for the close button if not already present
    if (!document.getElementById('detailViewStyles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'detailViewStyles';
        styleElement.textContent = `
            #planetDetailContainer {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
            }
            
            #planetDetailPanel {
                background-color: rgba(20, 20, 40, 0.9);
                color: white;
                border-radius: 10px;
                padding: 20px;
                max-width: 800px;
                width: 80%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 0 30px rgba(0, 100, 255, 0.5);
                border: 1px solid rgba(100, 150, 255, 0.5);
                position: relative;
            }
            
            .detail-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(100, 150, 255, 0.5);
                padding-bottom: 10px;
                margin-bottom: 20px;
            }
            
            .detail-header h2 {
                color: #88ccff;
                margin: 0;
            }
            
            .close-button {
                background-color: rgba(60, 60, 100, 0.8);
                color: white;
                border: 1px solid rgba(100, 150, 255, 0.5);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                font-size: 20px;
                line-height: 20px;
                cursor: pointer;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: background-color 0.2s, transform 0.1s;
            }
            
            .close-button:hover {
                background-color: rgba(80, 80, 120, 0.9);
                transform: scale(1.05);
            }
            
            .close-button:active {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Add direct event listener to close button
    const closeButton = document.getElementById('closeDetailView');
    if (closeButton) {
        closeButton.onclick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const detailContainer = document.getElementById('planetDetailContainer');
            if (detailContainer && detailContainer.parentNode) {
                detailContainer.parentNode.removeChild(detailContainer);
                currentView = 'universe';
            }
            
            return false;
        };
    }
    
    // Move camera to focus on the planet
    orbitControls.target.copy(starSystem.position);
    
    // Get planet's world position
    const planetWorldPos = new THREE.Vector3();
    planetObject.getWorldPosition(planetWorldPos);
    
    // Position camera relative to planet
    const planetPosition = planetObject.children[0].position.clone();
    const distance = planetData.size * 5;
    
    camera.position.set(
        planetWorldPos.x + distance,
        planetWorldPos.y + distance * 0.5,
        planetWorldPos.z + distance
    );
    
    camera.lookAt(planetWorldPos);
}

// Generate HTML for life information
function generateLifeHTML(lifeData) {
    if (!lifeData || lifeData.id === 'none') {
        return `<p class="life-status none">No life detected</p>`;
    }
    
    const discoveryStatus = lifeData.discovered ? 
        '<span class="discovery-status discovered">Discovered</span>' : 
        '<span class="discovery-status undiscovered">Undiscovered</span>';
    
    let lifeHTML = `
        <p class="life-status ${lifeData.id}">
            ${lifeData.name} ${discoveryStatus}
        </p>
        <p>${lifeData.description}</p>
    `;
    
    return lifeHTML;
}

// Generate HTML for biosphere details
function generateBiosphereHTML(lifeData) {
    if (!lifeData.biosphere) return '';
    
    const biosphere = lifeData.biosphere;
    
    let biosphereHTML = `
        <div class="biosphere-section">
            <h3>Biosphere Details</h3>
            <div class="biosphere-info">
                <p>Atmosphere: ${biosphere.atmosphere.type} (${biosphere.atmosphere.pressure.toFixed(2)} atm) 
                   ${biosphere.atmosphere.breathable ? '<span class="breathable">Breathable</span>' : '<span class="unbreathable">Unbreathable</span>'}</p>
                <p>Ecosystem stability: ${biosphere.ecosystem_stability}</p>
                <p>Biomass index: ${biosphere.biomass}</p>
            </div>
    `;
    
    if (biosphere.dominant_species.length > 0) {
        biosphereHTML += `<h4>Dominant Species</h4><ul class="species-list">`;
        biosphere.dominant_species.forEach(species => {
            biosphereHTML += `
                <li class="species-item">
                    <div class="species-name">${species.name}</div>
                    <div class="species-habitat">Habitat: ${species.habitat}</div>
                    <div class="species-desc">${species.description}</div>
                </li>
            `;
        });
        biosphereHTML += `</ul>`;
    }
    
    biosphereHTML += `</div>`;
    return biosphereHTML;
}

// Generate HTML for civilization details
function generateCivilizationHTML(lifeData) {
    if (!lifeData.civilization) return '';
    
    const civ = lifeData.civilization;
    
    return `
        <div class="civilization-section">
            <h3>Civilization Details</h3>
            <div class="civilization-info">
                <p class="civ-type">${civ.name}</p>
                <p>${civ.description}</p>
                <p>Technology level: ${civ.technology}</p>
                <p>Approximate population: ${Math.floor(Math.random() * 10) + 1} billion</p>
                <p>Major cities: ${Math.floor(Math.random() * 200) + 50}</p>
                <p>Political structure: ${['Unified Global Government', 'Nation States', 'City States', 'Tribal Confederations', 'Corporate Collectives'][Math.floor(Math.random() * 5)]}</p>
            </div>
        </div>
    `;
}

// Generate HTML for space stations
function generateSpaceStationsHTML(stations) {
    if (!stations || stations.length === 0) return '';
    
    let stationsHTML = `
        <div class="stations-section">
            <h3>Orbital Stations (${stations.length})</h3>
            <ul class="stations-list">
    `;
    
    stations.forEach(station => {
        stationsHTML += `
            <li class="station-item station-${station.id}">
                <div class="station-name">${station.name}</div>
                <div class="station-info">
                    <p>${station.description}</p>
                    <p>Size: ${['Small', 'Medium', 'Large'][station.size-1]}</p>
                    <p>Population: ${station.population}</p>
                    <p>Established: ${station.established}</p>
                </div>
            </li>
        `;
    });
    
    stationsHTML += `</ul></div>`;
    return stationsHTML;
}

// Function to display detailed view of star system
function showStarSystemDetail(starSystem) {
    // Store current system for reference
    currentSystem = starSystem;
    currentView = 'system';
    
    const systemData = starSystem.userData;
    
    // Create detailed information HTML
    let detailHTML = `
        <div id="systemDetailOverlay">
            <div id="systemDetailPanel">
                <div class="detail-header">
                    <h2>${systemData.name} System</h2>
                    <button id="closeDetailView" class="close-button" title="Close">×</button>
                </div>
                <div class="system-stats">
                    <div class="stat-column">
                        <h3>Star Information</h3>
                        <p>Spectral Class: ${systemData.spectralClass}</p>
                        <p>Temperature: ${systemData.temperature} K</p>
                        <p>Mass: ${systemData.mass} solar masses</p>
                        <p>Luminosity: ${systemData.luminosity} solar units</p>
                        <p>Age: ${systemData.age}</p>
                    </div>
                    <div class="stat-column">
                        <h3>System Information</h3>
                        <p>Total Planets: ${systemData.planets}</p>
                        <p>Habitable Planets: ${systemData.habitablePlanets}</p>
                        <p>Moons: ${countMoons(starSystem)}</p>
                        <p>System Stability: ${Math.random() > 0.3 ? 'Stable' : 'Unstable'}</p>
                    </div>
                </div>
                <div id="planetsList">
                    <h3>Planetary Bodies</h3>
                    <ul>
                        ${generatePlanetsList(starSystem)}
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing detail container first to prevent duplicates
    const existingDetailContainer = document.getElementById('systemDetailContainer');
    if (existingDetailContainer) {
        document.body.removeChild(existingDetailContainer);
    }
    
    // Create a new detail container
    const detailContainer = document.createElement('div');
    detailContainer.id = 'systemDetailContainer';
    document.body.appendChild(detailContainer);
    
    // Add the HTML to the container
    detailContainer.innerHTML = detailHTML;
    
    // Add direct event listener to close button
    const closeButton = document.getElementById('closeDetailView');
    if (closeButton) {
        closeButton.onclick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const detailContainer = document.getElementById('systemDetailContainer');
            if (detailContainer && detailContainer.parentNode) {
                detailContainer.parentNode.removeChild(detailContainer);
                currentView = 'universe';
            }
            
            return false;
        };
    }
    
    // Position camera to focus on the system
    orbitControls.target.copy(starSystem.position);
    camera.position.set(
        starSystem.position.x + systemData.radius * 10,
        starSystem.position.y + systemData.radius * 5,
        starSystem.position.z + systemData.radius * 10
    );
    camera.lookAt(starSystem.position);
}

// Helper function to count moons in a star system
function countMoons(starSystem) {
    let moonCount = 0;
    
    starSystem.children.forEach(child => {
        if (child.userData && child.userData.type === 'planet-orbit') {
            child.children.forEach(planetChild => {
                if (planetChild.userData && planetChild.userData.type === 'moon-orbit') {
                    moonCount++;
                }
            });
        }
    });
    
    return moonCount;
}

// Helper function to generate HTML list of planets
function generatePlanetsList(starSystem) {
    let planetsHTML = '';
    let planetIndex = 0;
    
    starSystem.children.forEach(child => {
        if (child.userData && child.userData.type === 'planet-orbit') {
            planetIndex++;
            const planetGroup = child;
            const planet = planetGroup.children.find(p => p instanceof THREE.Mesh);
            
            if (planet) {
                const inHabitableZone = child.userData.inHabitableZone;
                const isGasGiant = child.userData.isGasGiant;
                const planetType = child.userData.planetType || 
                    (isGasGiant ? 'Gas Giant' : (inHabitableZone ? 'Habitable Terrestrial' : 'Terrestrial'));
                
                const moonCount = planetGroup.children.filter(c => c.userData && c.userData.type === 'moon-orbit').length;
                
                planetsHTML += `
                    <li class="planet-item ${inHabitableZone ? 'habitable' : ''}">
                        <span class="planet-marker" style="background-color: #${planet.material.color.getHexString()}"></span>
                        Planet ${planetIndex}: ${planetType}
                        <span class="planet-details">Distance: ${(3 + (planetIndex-1) * 2).toFixed(1)} AU | Moons: ${moonCount}</span>
                    </li>
                `;
            }
        } else if (child.userData && child.userData.type === 'asteroid-belt') {
            planetsHTML += `
                <li class="planet-item asteroid-belt">
                    <span class="planet-marker" style="background-color: #8B7355"></span>
                    Asteroid Belt
                    <span class="planet-details">Distance: ${(3 + planetIndex * 2 + 0.5).toFixed(1)} AU</span>
                </li>
            `;
        }
    });
    
    return planetsHTML || '<li>No planets detected</li>';
}

// Add search functionality for stars and systems
function initializeSearchSystem() {
    // Create search UI if it doesn't exist
    let searchContainer = document.getElementById('searchContainer');
    if (!searchContainer) {
        searchContainer = document.createElement('div');
        searchContainer.id = 'searchContainer';
        searchContainer.innerHTML = `
            <div id="starExplorer">
                <h3>Star Explorer</h3>
                <div class="search-input-group">
                    <input type="text" id="searchQuery" placeholder="Search for star systems, planets...">
                    <select id="searchType">
                        <option value="all">All</option>
                        <option value="star-type">Star Type</option>
                        <option value="habitable">Habitable Planets</option>
                        <option value="gas-giant">Gas Giants</option>
                        <option value="black-hole">Black Holes</option>
                        <option value="life">Planets with Life</option>
                        <option value="advanced-life">Advanced Life</option>
                        <option value="space-stations">Space Stations</option>
                    </select>
                    <button id="searchButton">Search</button>
                </div>
                <div id="searchResults"></div>
            </div>
        `;
        document.body.appendChild(searchContainer);

        // Add event listeners for search functionality
        setTimeout(() => {
            const searchButton = document.getElementById('searchButton');
            const searchQuery = document.getElementById('searchQuery');
            
            if (searchButton && searchQuery) {
                searchButton.addEventListener('click', performSearch);
                searchQuery.addEventListener('keyup', function(event) {
                    if (event.key === 'Enter') {
                        performSearch();
                    }
                });
            }
        }, 100);
    }
}

// Update performSearch function to search for life and space stations
function performSearch() {
    const query = document.getElementById('searchQuery').value.toLowerCase();
    const searchType = document.getElementById('searchType').value;
    const resultsContainer = document.getElementById('searchResults');
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    let results = [];
    
    // Search through all galaxies and star systems
    universe.children.forEach(galaxy => {
        // Check if searching for black holes
        if (searchType === 'black-hole') {
            results.push({
                type: 'black-hole',
                name: `Black Hole at center of ${galaxy.userData.name}`,
                galaxy: galaxy.userData.name,
                object: galaxy
            });
        }
        
        // Search star systems
        galaxy.children.forEach(child => {
            if (child.userData && child.userData.systemType === 'star-system') {
                const systemData = child.userData;
                let matchesQuery = false;
                let matchesType = false;
                
                // Check if matches search text (or if query is empty, match everything)
                if (query === '' || systemData.name.toLowerCase().includes(query) || 
                    systemData.spectralClass.toLowerCase().includes(query)) {
                    matchesQuery = true;
                }
                
                // Check if matches type filter
                switch(searchType) {
                    case 'all':
                        matchesType = true;
                        break;
                    case 'star-type':
                        matchesType = true;
                        break;
                    case 'habitable':
                        matchesType = systemData.habitablePlanets > 0;
                        break;
                    case 'gas-giant':
                        // Check if system has gas giants
                        let hasGasGiants = false;
                        child.children.forEach(planetGroup => {
                            if (planetGroup.userData && planetGroup.userData.type === 'planet-orbit' && 
                                planetGroup.userData.isGasGiant) {
                                hasGasGiants = true;
                            }
                        });
                        matchesType = hasGasGiants;
                        break;
                    case 'life':
                    case 'advanced-life':
                    case 'space-stations':
                        // These will be handled at the planet level
                        matchesType = false;
                        break;
                    case 'black-hole':
                        matchesType = false; // Already handled above
                        break;
                    default:
                        matchesType = true;
                }
                
                if (matchesQuery && matchesType) {
                    results.push({
                        type: 'star-system',
                        name: systemData.name,
                        spectralClass: systemData.spectralClass,
                        habitablePlanets: systemData.habitablePlanets,
                        galaxy: galaxy.userData.name,
                        object: child
                    });
                }
                
                // Search for planets with life or space stations
                if (searchType === 'life' || searchType === 'advanced-life' || searchType === 'space-stations') {
                    child.children.forEach(planetGroup => {
                        if (planetGroup.userData && planetGroup.userData.type === 'planet-orbit') {
                            const planetData = planetGroup.userData;
                            
                            // Allow empty query to match when searching by category
                            if (query !== '' && !planetData.name.toLowerCase().includes(query)) {
                                return;
                            }
                            
                            let planetMatches = false;
                            
                            if (searchType === 'life' && 
                                planetData.life && 
                                planetData.life.id !== 'none') {
                                planetMatches = true;
                            }
                            else if (searchType === 'advanced-life' && 
                                planetData.life && 
                                (planetData.life.id === 'intelligent' || planetData.life.id === 'advanced')) {
                                planetMatches = true;
                            }
                            else if (searchType === 'space-stations' && 
                                planetData.life && 
                                planetData.life.spaceStations && 
                                planetData.life.spaceStations.length > 0) {
                                planetMatches = true;
                            }
                            
                            if (planetMatches) {
                                results.push({
                                    type: 'planet',
                                    name: planetData.name,
                                    planetType: planetData.type,
                                    lifeType: planetData.life ? planetData.life.name : 'None',
                                    stationCount: planetData.life && planetData.life.spaceStations ? 
                                        planetData.life.spaceStations.length : 0,
                                    systemName: systemData.name,
                                    galaxy: galaxy.userData.name,
                                    systemObject: child,
                                    planetObject: planetGroup
                                });
                            }
                        }
                    });
                }
            }
        });
    });
    
    // Display results
    if (results.length > 0) {
        const resultsList = document.createElement('ul');
        resultsList.className = 'search-results-list';
        
        // Add result count at the top
        const countElement = document.createElement('div');
        countElement.className = 'results-count';
        countElement.textContent = `Found ${results.length} result${results.length !== 1 ? 's' : ''}`;
        resultsContainer.appendChild(countElement);
        
        results.forEach(result => {
            const resultItem = document.createElement('li');
            resultItem.className = `search-result-item ${result.type}`;
            
            if (result.type === 'black-hole') {
                resultItem.innerHTML = `
                    <div class="result-icon black-hole-icon"></div>
                    <div class="result-info">
                        <div class="result-name">${result.name}</div>
                        <div class="result-location">Galaxy: ${result.galaxy}</div>
                    </div>
                `;
            } else if (result.type === 'star-system') {
                resultItem.innerHTML = `
                    <div class="result-icon star-icon" style="color: #${result.object.userData.color.getHexString()}"></div>
                    <div class="result-info">
                        <div class="result-name">${result.name}</div>
                        <div class="result-type">${result.spectralClass}</div>
                        <div class="result-location">Galaxy: ${result.galaxy}</div>
                        ${result.habitablePlanets > 0 ? 
                            `<div class="result-habitable">Habitable Planets: ${result.habitablePlanets}</div>` : ''}
                    </div>
                `;
            } else if (result.type === 'planet') {
                // Determine color based on life type
                let lifeColor = '#888888';
                if (result.lifeType !== 'No Life') {
                    if (result.lifeType === 'Advanced Civilization') {
                        lifeColor = '#ff00ff';
                    } else if (result.lifeType === 'Intelligent Life') {
                        lifeColor = '#00ffff';
                    } else if (result.lifeType === 'Complex Life') {
                        lifeColor = '#00ff00';
                    } else {
                        lifeColor = '#aaff00';
                    }
                }
                
                resultItem.innerHTML = `
                    <div class="result-icon planet-icon" style="background-color: #${result.planetObject.userData.color.getHexString()}"></div>
                    <div class="result-info">
                        <div class="result-name">${result.name}</div>
                        <div class="result-type">${result.planetType}</div>
                        <div class="result-system">System: ${result.systemName}</div>
                        <div class="result-location">Galaxy: ${result.galaxy}</div>
                        <div class="result-life" style="color: ${lifeColor}">
                            ${result.lifeType}
                            ${result.stationCount > 0 ? 
                                `<span class="station-indicator">🛰️ ${result.stationCount} station${result.stationCount > 1 ? 's' : ''}</span>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Add click event to navigate to the object
            resultItem.addEventListener('click', function() {
                if (result.type === 'planet') {
                    showPlanetDetail(result.planetObject, result.systemObject);
                } else {
                    navigateToObject(result.object);
                }
            });
            
            resultsList.appendChild(resultItem);
        });
        
        resultsContainer.appendChild(resultsList);
    } else {
        resultsContainer.innerHTML = '<p>No results found</p>';
    }
}

// Navigate camera to focus on a specific object
function navigateToObject(object) {
    // If it's a star system
    if (object.userData && object.userData.systemType === 'star-system') {
        // Show detailed view
        showStarSystemDetail(object);
    } 
    // If it's a galaxy (for black hole)
    else if (object.userData && object.userData.name) {
        // Close any open detail view
        const detailContainer = document.getElementById('systemDetailContainer');
        if (detailContainer) {
            detailContainer.innerHTML = '';
        }
        
        // Calculate world position
        const worldPos = new THREE.Vector3();
        object.getWorldPosition(worldPos);
        
        // Move camera to a position that shows the black hole
        orbitControls.target.copy(worldPos);
        camera.position.set(
            worldPos.x + 100,
            worldPos.y + 50,
            worldPos.z + 100
        );
        camera.lookAt(worldPos);
        
        currentView = 'universe';
    }
}

// Initialize search system
initializeSearchSystem();

// Add CSS styles for the new UI elements
function addStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #systemDetailContainer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        }
        
        #systemDetailPanel {
            background-color: rgba(20, 20, 40, 0.9);
            color: white;
            border-radius: 10px;
            padding: 20px;
            max-width: 800px;
            width: 80%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 0 30px rgba(0, 100, 255, 0.5);
            border: 1px solid rgba(100, 150, 255, 0.5);
            position: relative;
        }
        
        #systemDetailPanel h2 {
            color: #88ccff;
            margin-top: 0;
            border-bottom: 1px solid rgba(100, 150, 255, 0.5);
            padding-bottom: 10px;
        }
        
        #closeDetailView {
            position: absolute;
            top: 15px;
            right: 15px;
            background-color: rgba(50, 50, 80, 0.8);
            color: white;
            border: 1px solid rgba(100, 150, 255, 0.5);
            border-radius: 5px;
            padding: 5px 15px;
            cursor: pointer;
            z-index: 1100;
        }
        
        .system-stats {
            display: flex;
            margin-bottom: 20px;
        }
        
        .stat-column {
            flex: 1;
            padding: 10px;
        }
        
        .stat-column h3 {
            color: #aaccff;
            margin-top: 0;
        }
        
        #planetsList {
            background-color: rgba(30, 30, 60, 0.7);
            padding: 15px;
            border-radius: 8px;
        }
        
        #planetsList ul {
            list-style-type: none;
            padding: 0;
        }
        
        .planet-item {
            padding: 10px;
            border-bottom: 1px solid rgba(100, 150, 255, 0.3);
            display: flex;
            align-items: center;
        }
        
        .planet-marker {
            display: inline-block;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            margin-right: 10px;
        }
        
        .planet-details {
            color: #aaaaaa;
            margin-left: auto;
            font-size: 0.9em;
        }
        
        .planet-item.habitable {
            background-color: rgba(0, 100, 0, 0.2);
            border-left: 3px solid #00ff00;
        }
        
        #searchContainer {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 320px;
            background-color: rgba(20, 20, 40, 0.8);
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 0 15px rgba(0, 100, 255, 0.3);
            border: 1px solid rgba(100, 150, 255, 0.3);
            z-index: 100;
            font-family: Arial, sans-serif;
        }
        
        #starExplorer h3 {
            color: #88ccff;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.2em;
            font-family: inherit;
        }
        
        .search-input-group {
            display: flex;
            flex-direction: column;
            margin-bottom: 15px;
            gap: 8px;
        }
        
        #searchQuery {
            width: 100%;
            padding: 8px;
            border-radius: 5px;
            border: 1px solid rgba(100, 150, 255, 0.5);
            background-color: rgba(30, 30, 60, 0.8);
            color: white;
            box-sizing: border-box;
        }
        
        #searchType {
            width: 100%;
            padding: 8px;
            background-color: rgba(40, 40, 80, 0.8);
            color: white;
            border: 1px solid rgba(100, 150, 255, 0.5);
            border-radius: 5px;
            margin-bottom: 5px;
        }
        
        #searchButton {
            padding: 8px 15px;
            background-color: rgba(50, 80, 120, 0.8);
            color: white;
            border: 1px solid rgba(100, 150, 255, 0.5);
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
        }
        
        .search-results-list {
            list-style-type: none;
            padding: 0;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 15px;
        }
        
        .search-result-item {
            padding: 10px;
            border-bottom: 1px solid rgba(100, 150, 255, 0.3);
            display: flex;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .search-result-item:hover {
            background-color: rgba(50, 80, 120, 0.5);
        }
        
        .result-icon {
            width: 20px;
            height: 20px;
            margin-right: 10px;
            flex-shrink: 0;
        }
        
        .star-icon {
            border-radius: 50%;
            background-color: currentColor;
        }
        
        .black-hole-icon {
            border-radius: 50%;
            background-color: black;
            box-shadow: 0 0 5px rgba(150, 200, 255, 0.8);
        }
        
        .result-info {
            flex: 1;
        }
        
        .result-name {
            font-weight: bold;
            color: #aaccff;
        }
        
        .result-type, .result-location {
            font-size: 0.85em;
            color: #aaaaaa;
        }
        
        .result-habitable {
            color: #00ff00;
            font-size: 0.85em;
        }
        
        /* Debug panel styles */
        #debugPanel {
            position: fixed;
            top: 10px;
            left: 10px;
            background-color: rgba(30, 30, 30, 0.6);
            border-radius: 5px;
            padding: 8px 10px;
            z-index: 100;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: rgba(200, 200, 200, 0.8);
            pointer-events: none;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
            line-height: 1.3;
        }
        
        #debugPanel .debug-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .planet-item.asteroid-belt {
            background-color: rgba(139, 115, 85, 0.2);
            border-left: 3px solid #8B7355;
        }
        
        #performanceControls {
            position: fixed;
            bottom: 10px;
            left: 10px;
            background-color: rgba(20, 20, 40, 0.7);
            padding: 8px 12px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #ccc;
            z-index: 100;
        }
        
        #performanceControls label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        #performanceControls input {
            margin-right: 5px;
        }
        
        /* ... existing styles ... */
        
        #planetDetailContainer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        }
        
        #planetDetailPanel {
            background-color: rgba(20, 20, 40, 0.9);
            color: white;
            border-radius: 10px;
            padding: 20px;
            max-width: 800px;
            width: 80%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 0 30px rgba(0, 100, 255, 0.5);
            border: 1px solid rgba(100, 150, 255, 0.5);
            position: relative;
        }
        
        #planetDetailPanel h2 {
            color: #88ccff;
            margin-top: 0;
            border-bottom: 1px solid rgba(100, 150, 255, 0.5);
            padding-bottom: 10px;
        }
        
        #planetDetailPanel h3 {
            color: #aaccff;
            margin-top: 15px;
            margin-bottom: 10px;
        }
        
        #planetDetailPanel h4 {
            color: #bbddff;
            margin-top: 10px;
            margin-bottom: 5px;
        }
        
        .planet-stats {
            display: flex;
            margin-bottom: 20px;
        }
        
        .life-status {
            font-weight: bold;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 10px;
        }
        
        .life-status.none {
            background-color: #444;
            color: #aaa;
        }
        
        .life-status.microbial {
            background-color: #3a5c30;
            color: #aaff88;
        }
        
        .life-status.primitive {
            background-color: #2a5a2a;
            color: #88ff44;
        }
        
        .life-status.complex {
            background-color: #006600;
            color: #00ff00;
        }
        
        .life-status.intelligent {
            background-color: #006666;
            color: #00ffff;
        }
        
        .life-status.advanced {
            background-color: #660066;
            color: #ff00ff;
        }
        
        .discovery-status {
            font-size: 0.8em;
            margin-left: 8px;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .discovery-status.discovered {
            background-color: #2d662d;
            color: #aaffaa;
        }
        
        .discovery-status.undiscovered {
            background-color: #664d2d;
            color: #ffddaa;
        }
        
        .breathable {
            color: #88ff88;
        }
        
        .unbreathable {
            color: #ff8888;
        }
        
        .biosphere-section, 
        .civilization-section, 
        .stations-section {
            background-color: rgba(30, 40, 70, 0.5);
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }
        
        .species-list, 
        .stations-list {
            list-style-type: none;
            padding: 0;
        }
        
        .species-item, 
        .station-item {
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 8px;
            background-color: rgba(40, 60, 100, 0.3);
        }
        
        .species-name, 
        .station-name {
            font-weight: bold;
            color: #bbddff;
            margin-bottom: 4px;
        }
        
        .species-habitat {
            font-style: italic;
            margin-bottom: 4px;
            color: #aaccdd;
        }
        
        .civ-type {
            font-weight: bold;
            color: #ccaaff;
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        
        .station-research {
            border-left: 3px solid #88aaff;
        }
        
        .station-mining {
            border-left: 3px solid #ffaa44;
        }
        
        .station-colony {
            border-left: 3px solid #44cc88;
        }
        
        .station-military {
            border-left: 3px solid #ff4444;
        }
        
        .station-trade {
            border-left: 3px solid #ddaa44;
        }
        
        /* Search result styles for planets */
        .result-icon.planet-icon {
            border-radius: 50%;
        }
        
        .result-system {
            font-size: 0.85em;
            color: #aaaaaa;
        }
        
        .result-life {
            font-weight: bold;
            font-size: 0.9em;
        }
        
        .station-indicator {
            background-color: rgba(80, 80, 120, 0.7);
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 10px;
            font-size: 0.8em;
        }
        
        .results-count {
            color: #88ccff;
            font-size: 0.9em;
            margin-bottom: 10px;
            padding: 5px;
            border-bottom: 1px solid rgba(100, 150, 255, 0.3);
        }
        
        .search-results-list {
            list-style-type: none;
            padding: 0;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 5px;
        }
        
        #performanceControls {
            position: absolute;
            top: 20px;
            left: 20px;
            background-color: rgba(0, 10, 30, 0.7);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(100, 150, 255, 0.3);
            font-family: Arial, sans-serif;
            color: #eee;
            z-index: 100;
            width: 250px;
        }
        
        .control-group {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .control-group.checkbox {
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }
        
        .control-group.checkbox input {
            margin-right: 10px;
        }
        
        .slider-container {
            width: 150px;
            display: flex;
            align-items: center;
        }
        
        .slider {
            -webkit-appearance: none;
            appearance: none;
            width: 120px;
            height: 5px;
            background: #555;
            outline: none;
            opacity: 0.7;
            transition: opacity .2s;
            border-radius: 5px;
        }
        
        .slider:hover {
            opacity: 1;
        }
        
        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            background: #4CAF50;
            cursor: pointer;
            border-radius: 50%;
        }
        
        .slider::-moz-range-thumb {
            width: 15px;
            height: 15px;
            background: #4CAF50;
            cursor: pointer;
            border-radius: 50%;
        }
        
        .slider-value {
            margin-left: 10px;
            min-width: 20px;
            text-align: center;
        }
        
        .control-button {
            width: 100%;
            padding: 8px;
            margin-top: 10px;
            background-color: #2a4d69;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .control-button:hover {
            background-color: #4b6f89;
        }
        
        #performanceControls {
            position: absolute;
            top: 20px;
            left: 20px;
            background-color: rgba(0, 10, 30, 0.7);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(100, 150, 255, 0.3);
            font-family: Arial, sans-serif;
            color: #eee;
            z-index: 100;
        }
        
        .control-group {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        
        .control-group label {
            margin-right: 10px;
        }
        
        .slider {
            width: 100px;
            margin: 0 5px;
        }
        
        #orbitVisibilityValue {
            min-width: 15px;
            text-align: center;
        }
        
        #stationDetailContainer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        }
        
        #stationDetailOverlay {
            width: 80%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            color: #fff;
        }
        
        #stationDetailPanel {
            background-color: rgba(5, 20, 50, 0.9);
            border: 2px solid rgba(100, 150, 255, 0.6);
            border-radius: 10px;
            padding: 20px;
            position: relative;
        }
        
        #stationDetailPanel h2 {
            color: #66ccff;
            margin-top: 0;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(100, 150, 255, 0.3);
        }
        
        .station-stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .station-specific-info {
            background-color: rgba(10, 30, 60, 0.6);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .station-specific-info h3 {
            color: #ffcc22;
            margin-top: 0;
        }
        
        .station-controls {
            display: flex;
            justify-content: center;
            margin-top: 15px;
        }
        
        #viewPlanetButton {
            background-color: #444488;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        #viewPlanetButton:hover {
            background-color: #5555aa;
        }
    `;
    document.head.appendChild(styleElement);
}

// Call function to add styles
addStyles();

// Add event handler for the "Visible Objects" checkbox
function setupPerformanceControls() {
    // No longer needed - using main controls instead
    return;
}

// Function to update orbit line visibility
function updateOrbitLineVisibility(opacity) {
    // Find all orbit line objects in the scene
    universe.traverse(function(object) {
        if (object.type === 'Line' && object.userData && 
           (object.userData.type === 'planet-orbit-line' || 
            object.userData.type === 'moon-orbit-line')) {
            
            // Update the orbit line material
            if (object.material) {
                object.material.opacity = opacity;
                // Also adjust line width based on opacity
                object.material.linewidth = Math.max(1, Math.floor(opacity * 3));
            }
        }
    });
}

// Initialize orbit visibility (default value)
updateOrbitLineVisibility(0.5);

// Call performance controls setup
setupPerformanceControls(); 

// Function to display detailed view of a space station
function showStationDetail(stationObject, planetObject, starSystem) {
    // Store current system for reference
    currentSystem = starSystem;
    currentView = 'station';
    
    const stationData = stationObject.userData;
    const planetData = planetObject.userData;
    const systemData = starSystem.userData;
    
    // Create detailed information HTML
    let detailHTML = `
        <div id="stationDetailOverlay">
            <div id="stationDetailPanel">
                <h2>${stationData.name}</h2>
                <button id="closeDetailView">Close</button>
                <div class="station-stats">
                    <div class="stat-column">
                        <h3>Station Information</h3>
                        <p>Type: ${stationData.description}</p>
                        <p>Size: ${['Small', 'Medium', 'Large'][stationData.size-1]}</p>
                        <p>Population: ${stationData.population}</p>
                        <p>Established: ${stationData.established}</p>
                        <p>Orbiting: ${planetData.name}</p>
                        <p>Orbit Distance: ${(stationObject.position.x / planetData.size).toFixed(2)} planetary radii</p>
                    </div>
                    <div class="stat-column">
                        <h3>Planet Information</h3>
                        <p>Type: ${planetData.type}</p>
                        <p>Surface temperature: ${planetData.surfaceTemp}K</p>
                        <p>Life: ${planetData.life ? planetData.life.name : 'None'}</p>
                        <p>Distance from star: ${(planetData.orbitDistance / (systemData.radius * 3)).toFixed(2)} AU</p>
                    </div>
                </div>
                <div class="station-specific-info">
                    <h3>Station Details</h3>
                    ${getStationTypeSpecificInfo(stationData.station_id)}
                </div>
                <div class="station-controls">
                    <button id="viewPlanetButton">View Host Planet</button>
                </div>
            </div>
        </div>
    `;
    
    // Create a container for the details if it doesn't exist
    let detailContainer = document.getElementById('stationDetailContainer');
    if (!detailContainer) {
        detailContainer = document.createElement('div');
        detailContainer.id = 'stationDetailContainer';
        document.body.appendChild(detailContainer);
    }
    
    // Add the HTML to the container
    detailContainer.innerHTML = detailHTML;
    
    // Add event listeners
    setTimeout(() => {
        const closeButton = document.getElementById('closeDetailView');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                const detailContainer = document.getElementById('stationDetailContainer');
                if (detailContainer) {
                    document.body.removeChild(detailContainer);
                    currentView = 'universe';
                }
            });
        }
        
        const viewPlanetButton = document.getElementById('viewPlanetButton');
        if (viewPlanetButton) {
            viewPlanetButton.addEventListener('click', function() {
                const detailContainer = document.getElementById('stationDetailContainer');
                if (detailContainer) {
                    document.body.removeChild(detailContainer);
                }
                // Show the planet details
                showPlanetDetail(planetObject, starSystem);
            });
        }
    }, 100);
    
    // Move camera to focus on the station
    orbitControls.target.copy(starSystem.position);
    
    // Get station's world position
    const stationWorldPos = new THREE.Vector3();
    stationObject.getWorldPosition(stationWorldPos);
    
    // Position camera relative to station
    const stationSize = stationObject.children[0].geometry.parameters.radius || 1;
    const distance = stationSize * 15;
    
    camera.position.set(
        stationWorldPos.x + distance,
        stationWorldPos.y + distance * 0.5,
        stationWorldPos.z + distance
    );
    
    camera.lookAt(stationWorldPos);
}

// Function to get station-type specific information
function getStationTypeSpecificInfo(stationType) {
    switch(stationType) {
        case 'research':
            return `
                <p>Research Focus: ${['Astrophysics', 'Exobiology', 'Material Science', 'Quantum Physics'][Math.floor(Math.random() * 4)]}</p>
                <p>Scientific Discoveries: ${Math.floor(Math.random() * 50) + 5}</p>
                <p>Current Projects: ${Math.floor(Math.random() * 10) + 2}</p>
                <p>Lab Modules: ${Math.floor(Math.random() * 8) + 4}</p>
            `;
        case 'mining':
            return `
                <p>Resource Type: ${['Minerals', 'Metals', 'Rare Elements', 'Gases', 'Crystals'][Math.floor(Math.random() * 5)]}</p>
                <p>Extraction Rate: ${Math.floor(Math.random() * 1000) + 200} tons/day</p>
                <p>Refining Capacity: ${Math.floor(Math.random() * 80) + 20}%</p>
                <p>Mining Drones: ${Math.floor(Math.random() * 200) + 50}</p>
            `;
        case 'colony':
            return `
                <p>Habitation Rings: ${Math.floor(Math.random() * 5) + 1}</p>
                <p>Artificial Gravity: ${Math.random() > 0.2 ? 'Yes' : 'No'}</p>
                <p>Food Production: ${Math.floor(Math.random() * 90) + 10}% self-sufficient</p>
                <p>Recreation Facilities: ${Math.floor(Math.random() * 8) + 2}</p>
                <p>Government Type: ${['Democratic', 'Corporate', 'Technocratic', 'Colonial Authority'][Math.floor(Math.random() * 4)]}</p>
            `;
        case 'military':
            return `
                <p>Defense Systems: ${['Basic', 'Advanced', 'Experimental', 'Planetary Shield'][Math.floor(Math.random() * 4)]}</p>
                <p>Patrol Vessels: ${Math.floor(Math.random() * 20) + 5}</p>
                <p>Surveillance Range: ${Math.floor(Math.random() * 5) + 1} AU</p>
                <p>Personnel: ${Math.floor(Math.random() * 500) + 100} officers</p>
            `;
        case 'trade':
            return `
                <p>Docking Ports: ${Math.floor(Math.random() * 30) + 10}</p>
                <p>Trading Partners: ${Math.floor(Math.random() * 20) + 5}</p>
                <p>Market Volume: ${Math.floor(Math.random() * 900) + 100} million credits/day</p>
                <p>Primary Exports: ${['Technology', 'Luxury Goods', 'Raw Materials', 'Food', 'Manufactured Goods'][Math.floor(Math.random() * 5)]}</p>
                <p>Customs Security Level: ${['Low', 'Standard', 'High', 'Maximum'][Math.floor(Math.random() * 4)]}</p>
            `;
        default:
            return `<p>Station is operational and maintaining standard functions.</p>`;
    }
}