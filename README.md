# Procedural Universe Simulation

An interactive 3D simulation of a procedurally generated universe with galaxies and star systems. Built with Three.js.

## Features
- Procedurally generated galaxies (spiral and elliptical)
- Thousands of star systems within each galaxy
- Realistic galaxy shapes with spiral arms and density distributions
- Detailed star systems with planets and moons when zoomed in
- Interactive navigation with both orbit and fly controls
- Visual labels for galaxies and star systems
- Complete universe customization with controls

## How to Use
1. Open the `index.html` file in a web browser
2. Use mouse to orbit around the universe
3. Double-click on a galaxy to focus on it
4. Double-click on a star to view its solar system
5. Double-click empty space to return to previous view
6. Toggle between orbit controls and fly controls with the "Toggle View Mode" button
7. Generate a new universe with the "Generate New Universe" button
8. Adjust galaxy count and star density using the sliders

## Navigation Controls
- **Orbit Mode**: Click and drag to rotate, scroll to zoom
- **Fly Mode**: WASD keys to move, mouse to look around, scroll to adjust speed

## Technologies
- Three.js for 3D rendering
- Custom procedural generation using Simplex noise
- CSS2D labels for information display