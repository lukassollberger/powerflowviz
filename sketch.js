let arrows = [];
let particles = [];
let substations = [];
let lines = [];
console.log("D3.js Version:", d3.version); 
let minX, maxX, minY, maxY;
let aspect_ratio = 1  
let mapWidth = 800;
let mapHeight = 800;
let gridWidth = 800;
let gridHeight = 900;
let canvasWidth = mapWidth+100;
let canvasHeight = mapHeight+100;
let BKWmapImgscale = 1

let color380220kV = [0, 135, 45];
let color132kV = [255, 204, 0];
let color50kV = [0, 45, 105];
let colorBackground = [133, 207, 232];

let BKWmapImg;


let voltageLayers = {
    "380/220kV": { visible: true, lines: [], substations: [], particles: [] },
    "132kV":     { visible: true, lines: [], substations: [], particles: [] },
    "50kV":      { visible: true, lines: [], substations: [], particles: [] },
    "connector": { visible: true, lines: [], substations: [], particles: [] }

  };
  
let maxPower = 0; 

// let fetchButton;
// let lastUpdateTime = "Unbekannt";

let latestUpdateTime = "";

function preload() {
  BKWmapImg = loadImage("bkw_map.png");  // transparentes Bild laden
  load_substations();
  load_lines();
  loadLastUpdateTime(); // 🔄 Load timestamp
  klintFont = loadFont("fonts/KlintforBKW-Regular.ttf");


}

function loadLastUpdateTime() {
  loadStrings("latest_timestamp.txt", result => {
    latestUpdateTime = `Letztes Update: ${result[0]}`;
  });
}

function load_substations() {
    d3.dsv(";", "substations_list.csv", d3.autoType)
        .then(function (csv) {
            // Get min/max for scaling
            minX = d3.min(csv, d => d.X);
            maxX = d3.max(csv, d => d.X);
            minY = d3.min(csv, d => d.Y);
            maxY = d3.max(csv, d => d.Y);
            maxPower = d3.max(csv, d => d.P_MW || 0); 

            console.log("🔹 Original coordinate range: X(", minX, "to", maxX, "), Y(", minY, "to", maxY, ")");

            // Normalize and scale substations
            csv.forEach(d => {
                let scaledX = map(d.X, minX, maxX, 50, gridWidth);
                let scaledY = map(d.Y, minY, maxY, 50, gridHeight);
                
                const sub = {
                    type: d.Type,
                    name: d.Name,
                    x: scaledX,
                    y: scaledY,
                    power: d.P_MW || 0 // store the 16kV power

                  };
                  
                  substations.push(sub);
                  
                  if (voltageLayers[d.Type]) {
                    voltageLayers[d.Type].substations.push(sub);
                  }
                  
            });

            console.log("✅ Scaled substations:", substations);
        })
        .catch(function (error) {
            console.error("❌ Error loading substations CSV:", error);
        });
}


function load_lines() {
    d3.dsv(";", "line_list_out.csv", d3.autoType)
        .then(function (csv) {
            csv.forEach(row => {
              let type = row.Type;
              let fromName = row.From;
              let toName = row.To;
              let power = row.P_MW;

              // 🔁 Richtungswechsel bei negativer Leistung
              if (power < 0) {
                  [fromName, toName] = [toName, fromName];  // swap
                  power = Math.abs(power); // positiv machen
              }

              const lineName = row.Line_Name;
              const lineAbbrev = row.Line_Abbreviation;

              const fromStation = substations.find(s => s.name === fromName);
              const toStation = substations.find(s => s.name === toName);
              console.log(`→ ${fromName} → ${toName} | P = ${power}`);

              let waypoints = [];
              if (row.Waypoints) {
                  let raw = row.Waypoints.includes("|") ? row.Waypoints.split("|") : [row.Waypoints];

                  waypoints = raw.map(pair => {
                      let [origX, origY] = pair.split(",").map(Number);
                      let x = map(origX, minX, maxX, 50, gridWidth);
                      let y = map(origY, minY, maxY, 50, gridHeight);
                      return { x, y };
                  });
              }

              if (fromStation && toStation) {
                  if (voltageLayers[type]) {
                      voltageLayers[type].lines.push({
                          type,
                          from: fromStation,
                          to: toStation,
                          power,
                          lineName,
                          lineAbbrev,
                          waypoints
                      });
                  }
              }
          });

            console.log("✅ Parsed lines:", lines);
        })
        .catch(function (error) {
            console.error("❌ Error loading lines CSV:", error);
        });
}


function setup() {
    noStroke();
    createCanvas(canvasWidth, canvasHeight);
}

// function fetchLatestData() {
//   fetchButton.html("⏳ Loading...");
  
//   // Call the Python script
//   fetch("http://localhost:5000/run-script")  // Adjust if needed
//     .then(response => response.json())
//     .then(data => {
//       console.log("✅ Script executed:", data);
//       fetchButton.html("🔄 Fetch latest data");
//       loadLastUpdateTime();
//     })
//     .catch(error => {
//       console.error("❌ Error running script:", error);
//       fetchButton.html("⚠️ Error");
//     });
// }


function draw() {
    background(colorBackground);

    push();
    tint(255, 255, 255, 255);  
    image(BKWmapImg, 0, 50, mapWidth*BKWmapImgscale, mapHeight*BKWmapImgscale);  
    noTint();  
    pop();
    if (substations.length === 0) {
        text("Loading data...", width / 2, height / 2);
        return;
    }
 
    for (let voltage in voltageLayers) {
        const layer = voltageLayers[voltage];
      
        if (!layer.visible) continue;
      
        // Draw lines
        strokeWeight(2);
        layer.lines.forEach(l => {
              // 🟢 Set stroke color based on voltage type
              if (l.type === "380/220kV") {
                stroke(color380220kV);       // Green
              } else if (l.type === "132kV") {
                stroke(color132kV);     // Orange
              } else if (l.type === "50kV") {
                stroke(color50kV);     // Blue
              } else {
                stroke(100);             // Fallback gray
              }

              noFill();
              beginShape();
              vertex(l.from.x, l.from.y);
              l.waypoints?.forEach(wp => vertex(wp.x, wp.y));
              vertex(l.to.x, l.to.y);
              endShape();
         });
      
        // Particle generation
        noStroke();
        if (frameCount % 20 === 0) {
            layer.lines.forEach(l => {
              for (let i = 0; i < l.power / 20; i++) {

                const path = [l.from, ...(l.waypoints || []), l.to];

                layer.particles.push({
                  x: path[0].x,
                  y: path[0].y,
                  speed: random(0.1, 0.4),
                  path: path,
                  currentSegment: 0
                });
                
              }
            });
          }
1          
      
        for (let i = layer.particles.length - 1; i >= 0; i--) {
              let p = layer.particles[i];

              // Get current segment
              let start = p.path[p.currentSegment];
              let end   = p.path[p.currentSegment + 1];
              
              if (!end) {
                // Reached end of path
                layer.particles.splice(i, 1);
                continue;
              }
              
              let angle = atan2(end.y - p.y, end.x - p.x);
              p.x += cos(angle) * p.speed;
              p.y += sin(angle) * p.speed;
              
              // If close to end of segment, move to next segment
              if (dist(p.x, p.y, end.x, end.y) < 1) {
                p.currentSegment++;
              }

              // drawingContext.shadowBlur = 15;
              // drawingContext.shadowColor = color(0, 255, 0, 255);
    
              fill(255, 255, 0, 180);
              ellipse(p.x, p.y, 4, 4);
          }
          
        // Draw substations
        noStroke();
        layer.substations.forEach(sub => {
          let subColor = color(150);
          let size = 4;
      
          if (sub.type === "380/220kV") {
            subColor = color(color380220kV);
            size = 12;
          } else if (sub.type === "132kV") {
            subColor = color(color132kV);
            size = 8;
          } else if (sub.type === "50kV") {
            subColor = color(color50kV);
            size = 6;
          }
      
          // fill(subColor);
          // ellipse(sub.x, sub.y, size, size);

          // Glow effect based on power
          drawingContext.shadowBlur = 15;
          let alpha = map(sub.power, 0, maxPower, 0, 255); // map(value, inMin, inMax, outMin, outMax)
          drawingContext.shadowColor = color(255, 0, 0, alpha);

          fill(subColor);
          ellipse(sub.x, sub.y, size, size);

          // Reset shadow for next elements
          drawingContext.shadowBlur = 0;

          fill(0);
          textAlign(CENTER, TOP);
          textSize(4);
          text(sub.name, sub.x, sub.y + size / 2 + 2);
        });
      }
      

    // // 🎇 **Update and draw particles with smooth movement**
    // strokeWeight(0);
    // for (let i = particles.length - 1; i >= 0; i--) {
    //     let p = particles[i];

    //     // Move towards target
    //     let angle = atan2(p.targetY - p.y, p.targetX - p.x);
    //     p.x += cos(angle) * p.speed;
    //     p.y += sin(angle) * p.speed;

    //     fill(200, 200, 0, 180);
    //     ellipse(p.x, p.y, 4, 4); 

    //     // Remove particles when close to the target
    //     if (dist(p.x, p.y, p.targetX, p.targetY) < 5) {
    //         particles.splice(i, 1);
    //     }
    // }    
 
/* // Generate new arrows based on power value
    noStroke();
    lines.forEach(l => {
        for (let i = 1; i < l.power; i++) {
            if (frameCount % 20 === 0) {
                arrows.push({
                    x: l.from.x,
                    y: l.from.y,
                    speed: 1,
                    angle: atan2(l.to.y - l.from.y, l.to.x - l.from.x),
                    targetX: l.to.x,
                    targetY: l.to.y
                });
            }
        }
    });
  
  // Update and draw arrows
    for (let i = arrows.length - 1; i >= 0; i--) {
        let a = arrows[i];
        a.x += cos(a.angle) * a.speed;
        a.y += sin(a.angle) * a.speed;
        
        push();
        translate(a.x, a.y);
        rotate(a.angle);
        fill(0, 255, 0, 10);
        triangle(-2.5, -2.5, -2.5, 2.5, 2.5, 0); // Arrow shape
        pop();
        
        // Remove arrows that reach their target
        if (dist(a.x, a.y, a.targetX, a.targetY) < 5) {
            arrows.splice(i, 1);
        }
    }*/
    
     // Draw substations
    //  noStroke();
    //  substations.forEach(sub => {
    //      let subColor = color(150); // Default gray
    //      let size = 4; // Default size
 
    //      if (sub.type === "380/220kV") {
    //          subColor = color(0, 255, 0); // Green
    //          size = 12;
    //      } else if (sub.type === "132kV") {
    //          subColor = color(255, 165, 0); // Orange
    //          size = 8;
    //      } else if (sub.type === "50kV") {
    //          subColor = color(0, 100, 255); // Blue
    //          size = 6;
    //      }
 
    //      fill(subColor);
    //      ellipse(sub.x, sub.y, size, size); // Use different sizes
    //      fill(0); // Black text
    //      textAlign(CENTER, TOP);
    //      textSize(4);
    //      text(sub.name, sub.x, sub.y + size / 2 + 2); // Below the circle
    //  }); 
   
    drawLegend();
    drawTitle();

    // Draw Mouse Pos onto screen
    if (substations.length > 0) {
      // Convert canvas to original coordinates
      let origX = map(mouseX, 50, gridWidth, minX, maxX);
      let origY = map(mouseY, 50, gridHeight, minY, maxY);
    
      // Optional: round for readability
      origX = nf(origX, 1, 0);  // or use toFixed()
      origY = nf(origY, 1, 0);
    
      // Draw background label
      fill(255, 255, 255, 200);
      rect(mouseX + 10, mouseY, 100, 30, 5);
    
      // Draw text
      fill(0);
      textSize(10);
      text(`X: ${origX}`, mouseX + 15, mouseY + 10);
      text(`Y: ${origY}`, mouseX + 15, mouseY + 22);
    }
    
    // textSize(10);
    // fill(0);
    // textAlign(LEFT, TOP);
    // text("📅 Letztes Update: " + lastUpdateTime, 20, canvasHeight - 30);

    fill(255);
    textAlign(LEFT, BOTTOM);
    textSize(10);
    text(latestUpdateTime, 20, canvasHeight - 10);
}

function keyPressed() {
    if (key === '1') voltageLayers["380/220kV"].visible = !voltageLayers["380/220kV"].visible;
    if (key === '2') voltageLayers["132kV"].visible     = !voltageLayers["132kV"].visible;
    if (key === '3') voltageLayers["50kV"].visible       = !voltageLayers["50kV"].visible;
  
    console.log("🔁 Voltage layer visibility:", {
      "380/220kV": voltageLayers["380/220kV"].visible,
      "132kV": voltageLayers["132kV"].visible,
      "50kV": voltageLayers["50kV"].visible
    });
  }
  
  function drawLegend() {
    const items = [
      { key: "Numpad 1", label: "380/220kV", color: color(color380220kV), visible: voltageLayers["380/220kV"].visible },
      { key: "Numpad 2", label: "132kV",     color: color(color132kV), visible: voltageLayers["132kV"].visible },
      { key: "Numpad 3", label: "50kV",      color: color(color50kV), visible: voltageLayers["50kV"].visible }
    ];
  
    textAlign(LEFT, CENTER);
    textSize(10);
    let x = 20;
    let y = 40;
    
    text("Spannungsebene:",x,y-10);
    items.forEach((item, index) => {
      fill(item.visible ? item.color : 150);
      rect(x, y + index * 25, 15, 15, 3);
  
      fill(0);
      text(`[${item.key}] ${item.label}`, x + 25, y + index * 25 + 7);
    });
  }

  function drawTitle() {
    textAlign(CENTER, TOP);
    textSize(20);
    textFont(klintFont);
    fill(255);
    text("Verteilnetze BKW und Umgebung inkl. Übertragungsnetz", canvasWidth / 2, 10);
  }
  
  