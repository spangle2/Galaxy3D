# Procedural Universe Simulation

An interactive 3D simulation of a procedurally generated universe with galaxies and detailed star systems. Built with Three.js.

## Features
- Procedurally generated galaxies (spiral and elliptical)
- Thousands of star systems within each galaxy
- Each star system contains planets and moons visible when you fly close enough
- Realistic galaxy shapes with spiral arms and density distributions
- Orbit animations for planets within each star system
- Interactive navigation with both orbit and fly controls
- Visual labels for galaxies and star systems
- Complete universe customization with controls

## How to Use
1. Open the `index.html` file in a web browser
2. Use mouse to orbit around the universe
3. Double-click on a galaxy to focus on it
4. Fly close to any star to see its solar system with orbiting planets
5. Double-click on a star to view its detailed solar system
6. Double-click empty space to return to previous view
7. Toggle between orbit controls and fly controls with the "Toggle View Mode" button
8. Generate a new universe with the "Generate New Universe" button
9. Adjust galaxy count and star density using the sliders
10. Toggle visibility of orbits and labels with the checkboxes

## Navigation Controls
- **Orbit Mode**: Click and drag to rotate, scroll to zoom
- **Fly Mode**: WASD keys to move, mouse to look around, scroll to adjust speed

## Star Systems
- Each star within a galaxy has its own miniature solar system
- Planets orbit their stars, and some planets have moons
- Orbits and planets become visible as you approach a star
- Information about nearby star systems appears in the control panel

## Technologies
- Three.js for 3D rendering
- Custom procedural generation using Simplex noise
- CSS2D labels for information display