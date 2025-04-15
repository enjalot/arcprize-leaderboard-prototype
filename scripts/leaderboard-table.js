// -----------------------------------------
// Regular Table Generator for leaderboard.csv
// -----------------------------------------
function createLeaderboardTable(containerId, csvUrl) {
  // Get container and add class for consistent styling
  const container = document.getElementById(containerId);
  container.classList.add('leaderboard-table');

  // ---------------------------------------
  // 1. Helper function to parse CSV in plain JS
  //    (If you prefer to use PapaParse or a library,
  //     you can replace this with that library code.)
  // ---------------------------------------
  function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    // First line is assumed to be the header
    const headers = rows[0].split(",");
    
    // Convert each subsequent row into an object
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const line = rows[i].trim();
      // Skip empty lines
      if (!line) continue;
      
      const cols = line.split(",");
      const rowData = {};
      headers.forEach((hdr, idx) => {
        // Trim quotes/spaces
        rowData[hdr.trim()] = (cols[idx] || "").trim();
      });
      data.push(rowData);
    }
    return data;
  }

  // ---------------------------------------
  // 2. Load CSV data from the provided URL
  // ---------------------------------------
  fetch(csvUrl)
    .then(response => response.text())
    .then(csvText => {
      const rawData = parseCSV(csvText);

      // Convert numeric columns to actual numbers
      // (We specifically care about v2_Semi_Private_Score & v2_Semi_Private_Cost_Per_Task)
      rawData.forEach(d => {
        d.v2_Semi_Private_Score = d.v2_Semi_Private_Score ? +d.v2_Semi_Private_Score : null;
        d.v2_Semi_Private_Cost_Per_Task = d.v2_Semi_Private_Cost_Per_Task
          ? +d.v2_Semi_Private_Cost_Per_Task
          : null;

        // Convert 'display' column to boolean
        if (typeof d.display !== "undefined") {
          d.display = (d.display.toLowerCase() === "true");
        }
      });

      // Filter out rows where display != true and rows containing "a" values
      const filteredData = rawData.filter(d => {
        const points_to_show_on_table = ['gemini-2.5-pro-exp-03-25'];
        
        // If the Config is in points_to_show_on_table, show it regardless of display value
        if (points_to_show_on_table.includes(d.Config)) return true;
        
        // Otherwise, check display status
        if (!(d.display === true || d.display === "true")) return false;
        
        // Check for "a" values in any field
        for (const key in d) {
          if (d[key] === "a") return false;
        }
        
        // Filter out entries with no score or cost
        if (d.v2_Semi_Private_Score === null || isNaN(d.v2_Semi_Private_Score)) return false;
        if (d.v2_Semi_Private_Cost_Per_Task === null || isNaN(d.v2_Semi_Private_Cost_Per_Task)) return false;
        
        return true;
      });

      // Sort data by score (high to low)
      filteredData.sort((a, b) => {
        // Handle null values by placing them at the end
        if (a.v2_Semi_Private_Score === null) return 1;
        if (b.v2_Semi_Private_Score === null) return -1;
        // Sort in descending order
        return b.v2_Semi_Private_Score - a.v2_Semi_Private_Score;
      });

      // Now render the table
      buildTable(filteredData);
    })
    .catch(err => {
      console.error("Error fetching or parsing the CSV data:", err);
    });

  // ---------------------------------------
  // 3. Build the table and append it to the container
  // ---------------------------------------
  function buildTable(data) {
    // Get the container element (where table should be placed)
    const container = document.getElementById(containerId);

    // Clear any existing content
    container.innerHTML = "";

    // Create a <table> with Bootstrap-like classes
    const table = document.createElement("table");
    table.className = "data-table table table-striped";

    // Create the header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    // Define the columns we want
    const columns = [
      { key: "model", label: "AI System", sortable: true },
      { key: "org", label: "Organization", sortable: true },
      { key: "systemType", label: "System Type", sortable: true },
      { key: "score-1", label: "ARC-AGI-1", sortable: true },
      { key: "score-2", label: "ARC-AGI-2", sortable: true },
      { key: "cost", label: "Cost/Task", sortable: true },
      { key: "links", label: "Code / Paper", sortable: false }
    ];

    // Append header cells
    columns.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col.label;
      if (col.sortable) {
        th.setAttribute('data-sort', col.key);
        th.style.cursor = 'pointer';
      }
      if (col.key == 'score-2') {
        th.setAttribute('style', 'background-color: #e53aa3cf;')
      }
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create <tbody>
    const tbody = document.createElement("tbody");

    data.forEach(d => {
      // Extract the relevant data:
      // - Model (Display_Name)
      // - Org (Provider)
      // - System Type (Model_Type)
      // - Score v1 (v1_Semi_Private_Score)
      // - Score v2 (v2_Semi_Private_Score)
      // - Cost (v2_Semi_Private_Cost_Per_Task)
      // - Links (icons if any)
      const modelName = d.Display_Name || d.Config || "N/A";
      const orgName = d.Provider || "N/A";
      const systemType = d.Model_Type || "N/A";

      // Format the score:
      // If 0 < score < 1, treat it like a percentage (score * 100)
      let finalScoreV1 = "N/A";
      if (d.v1_Semi_Private_Score !== null && !isNaN(d.v1_Semi_Private_Score)) {
        let tempScoreV1 = d.v1_Semi_Private_Score;
        // Multiply by 100 if it's a decimal less than 1 OR if it equals 1
        if ((tempScoreV1 > 0 && tempScoreV1 <= 1)) {
          tempScoreV1 = tempScoreV1 * 100;
        }
        if (tempScoreV1 === '') {
          tempScoreV1 = '-';
        } else {
          finalScoreV1 = Number(tempScoreV1).toFixed(1) + "%";
        }
      }

      let finalScoreV2 = "N/A";
      if (d.v2_Semi_Private_Score !== null && !isNaN(d.v2_Semi_Private_Score)) {
        let tempScoreV2 = d.v2_Semi_Private_Score;
        // Multiply by 100 if it's a decimal less than 1 OR if it equals 1
        if ((tempScoreV2 > 0 && tempScoreV2 <= 1)) {
          tempScoreV2 = tempScoreV2 * 100;
        }
        if (tempScoreV2 === '') {
          tempScoreV2 = '-';
        } else {
          finalScoreV2 = Number(tempScoreV2).toFixed(1) + "%";
        }
      }

      // Format the cost:
      // e.g., if cost < 1, show up to 3 decimals
      // if cost < 1000, show 2 decimals
      // else show in thousands
      let finalCost = "N/A";
      const costVal = d.v2_Semi_Private_Cost_Per_Task;
      if (costVal !== null && !isNaN(costVal)) {
        if (costVal < 1) {
          finalCost = "$" + costVal.toFixed(3);
        } else if (costVal < 1000) {
          finalCost = "$" + costVal.toFixed(2);
        } else {
          finalCost = "$" + (costVal / 1000).toFixed(1) + "K";
        }
      }

      // Build the links cell:
      // We show a code icon if there's a code URL,
      // a paper icon if there's a paper URL, etc.
      // Adjust these columns as your CSV evolves.
      let linksHTML = "";
      const paperURL = d.Paper_URL;
      const codeURL  = d.Code_URL;

      // If there's a paper link
      if (paperURL) {
        linksHTML += `<a href="${paperURL}" target="_blank" style="text-decoration: none; margin-right: 8px;">📄</a>`;
      }
      // If there's a code link
      if (codeURL) {
        linksHTML += `<a href="${codeURL}" target="_blank" style="text-decoration: none; margin-right: 8px;">💻</a>`;
      }
      // If no links, put a dash or empty string
      if (!linksHTML) {
        linksHTML = "—";
      }

      // Now create the row with model ID for potential interactions
      const row = document.createElement("tr");
      row.setAttribute('data-model-id', d.Config || '');
      row.style.cursor = 'pointer';

      // Add optional hover effect (similar to D3 version)
      row.addEventListener('mouseover', function() {
        if (window.leaderboardDots && window.leaderboardDots[d.Config]) {
          // Similar hover effect as in D3 version
          // This is a placeholder to match the style
        }
      });

      // Model cell - add color styling like D3 version
      const cellModel = document.createElement("td");
      cellModel.textContent = modelName;
      if (window.leaderboardColors && d.Model_Group) {
        cellModel.style.color = window.leaderboardColors[d.Model_Group] || '';
      }
      row.appendChild(cellModel);

      // Org cell
      const cellOrg = document.createElement("td");
      cellOrg.textContent = orgName;
      row.appendChild(cellOrg);

      // System Type cell
      const cellSystemType = document.createElement("td");
      cellSystemType.textContent = systemType;
      row.appendChild(cellSystemType);

      // Score v1 cell
      const cellScoreV1 = document.createElement("td");
      cellScoreV1.textContent = finalScoreV1;
      row.appendChild(cellScoreV1);

      // Score v2 cell
      const cellScoreV2 = document.createElement("td");
      cellScoreV2.textContent = finalScoreV2;
      row.appendChild(cellScoreV2);


      // Cost cell
      const cellCost = document.createElement("td");
      cellCost.textContent = finalCost;
      row.appendChild(cellCost);

      // Links cell
      const cellLinks = document.createElement("td");
      cellLinks.innerHTML = linksHTML; // we used `innerHTML` because we built link markup
      row.appendChild(cellLinks);

      // Finally, append row to the tbody
      tbody.appendChild(row);
    });

    // Append the tbody to the table
    table.appendChild(tbody);

    // Place the complete table into the container
    container.appendChild(table);
  }
}
// Leaderboard Table Generator
// function createLeaderboardTable(containerId, dataUrl, options = {}) {
//   // Default options
//   const defaults = {
//     sortBy: 'performance', // Default sort by performance
//     sortDirection: 'desc', // Default sort direction
//     highlightOnHover: true, // Whether to highlight dots on hover
//     dataSource: "v2_Semi_Private" // Default data source - hard-coded
//   };
  
//   // Merge defaults with provided options
//   const config = {...defaults, ...options};
  
//   // Data source configurations for different evaluation types
//   const dataSources = {
//     "v1_Public_Eval": {
//       scoreColumn: "v1_Public_Eval_Score",
//       costColumn: "v1_Public_Eval_Cost_Per_Task",
//       title: "V1 Public Evaluation"
//     },
//     "v1_Semi_Private": {
//       scoreColumn: "v1_Semi_Private_Score",
//       costColumn: "v1_Semi_Private_Cost_Per_Task",
//       title: "V1 Semi-Private Evaluation"
//     },
//     "v1_Private_Eval": {
//       scoreColumn: "v1_Private_Eval_Score",
//       costColumn: "v1_Private_Eval_Cost_Per_Task",
//       title: "V1 Private Evaluation"
//     },
//     "v2_Public_Eval": {
//       scoreColumn: "v2_Public_Eval_Score",
//       costColumn: "v2_Public_Eval_Cost_Per_Task",
//       title: "V2 Public Evaluation"
//     },
//     "v2_Semi_Private": {
//       scoreColumn: "v2_Semi_Private_Score",
//       costColumn: "v2_Semi_Private_Cost_Per_Task",
//       title: "V2 Semi-Private Evaluation"
//     },
//     "v2_Private_Eval": {
//       scoreColumn: "v2_Private_Eval_Score",
//       costColumn: "v2_Private_Eval_Cost_Per_Task",
//       title: "V2 Private Evaluation"
//     }
//   };
  
//   // Get container
//   const container = d3.select(`#${containerId}`)
//     .classed('leaderboard-table', true);
  
//   // Clear any existing content
//   container.html("");
  
//   // Function to process data for the current data source
//   function processAndDisplayData(data) {
//     // Get the active data source
//     const activeSource = dataSources[config.dataSource];
    
//     // Process data for the selected source
//     data.forEach(d => {
//       // Set score and cost based on active data source
//       d.score = d[activeSource.scoreColumn];
//       d.cost = d[activeSource.costColumn];
      
//       // If the score is in decimal form (less than 1), multiply by 100 to get percentage
//       if (d.score < 1 && d.score > 0) {
//         d.performance = d.score * 100;
//       } else {
//         d.performance = d.score;
//       }
//     });
    
//     // Filter data to only include points where display is true and the selected column has data
//     const displayData = data.filter(d => 
//       (d.display === "true" || d.display === "True" || d.display === true) && 
//       d.score != null && d.cost != null
//     );
    
//     // Sort based on current sort settings
//     sortData(displayData, config.sortBy, config.sortDirection);
    
//     // Create or update table
//     if (!container.select(".data-table").empty()) {
//       updateTableBody(container.select(".data-table"), displayData);
//     } else {
//       createTable(displayData);
//     }
//   }
  
//   // Function to create and populate the table
//   function createTable(data) {
//     // Create table
//     const table = container.append("table")
//       .attr("class", "data-table table table-striped");
    
//     // Create header
//     const header = table.append("thead").append("tr");
    
//     // Add sortable headers
//     const headers = [
//       { id: 'model', text: 'Model' },
//       { id: 'paper', text: 'Paper' },
//       { id: 'code', text: 'Code' },
//       { id: 'performance', text: 'Score' },
//       { id: 'cost_per_task', text: 'Cost/Task' }
//     ];
    
//     headers.forEach(h => {
//       header.append("th")
//         .attr("data-sort", h.id)
//         .attr("class", config.sortBy === h.id ? `sort-${config.sortDirection}` : "")
//         .text(h.text)
//         .on("click", function() {
//           const currentSort = d3.select(this).attr("data-sort");
//           let newDirection = "desc";
          
//           // Toggle direction if already sorted by this column
//           if (config.sortBy === currentSort) {
//             newDirection = config.sortDirection === "desc" ? "asc" : "desc";
//           }
          
//           // Update sort settings
//           config.sortBy = currentSort;
//           config.sortDirection = newDirection;
          
//           // Clear existing sort indicators
//           header.selectAll("th").classed("sort-asc", false).classed("sort-desc", false);
          
//           // Add sort indicator to current header
//           d3.select(this).classed(`sort-${newDirection}`, true);
          
//           // Resort and redraw table body
//           sortData(data, config.sortBy, config.sortDirection);
//           updateTableBody(table, data);
//         });
//     });
    
//     // Create table body
//     const tbody = table.append("tbody");
    
//     // Add rows
//     updateTableBody(table, data);
    
//     return table;
//   }
  
//   // Function to sort data
//   function sortData(data, sortBy, direction) {
//     data.sort((a, b) => {
//       let comparison;
      
//       if (sortBy === 'model') {
//         comparison = a.Display_Name.localeCompare(b.Display_Name);
//       } else if (sortBy === 'performance') {
//         comparison = (a.performance || 0) - (b.performance || 0);
//       } else if (sortBy === 'cost_per_task') {
//         comparison = (a.cost || 0) - (b.cost || 0);
//       }
      
//       return direction === 'asc' ? comparison : -comparison;
//     });
//   }
  
//   // Function to update table body with sorted data
//   function updateTableBody(table, data) {
//     const tbody = table.select("tbody");
    
//     // Remove existing rows
//     tbody.selectAll("tr").remove();
    
//     // Add new rows
//     const rows = tbody.selectAll("tr")
//       .data(data)
//       .enter().append("tr")
//       .attr("data-model-id", d => d.Config)
//       .style("cursor", "pointer");
    
//     // Add hover effect if enabled
//     if (config.highlightOnHover) {
//       rows.on("mouseover", function(event, d) {
//         // Check if leaderboard chart exists and has dots
//         if (window.leaderboardDots && window.leaderboardDots[d.Config]) {
//           // Dim all dots
//           d3.selectAll(".dot")
//             .transition().duration(200)
//             .style("opacity", 0.2)
//             .attr("r", 5);
          
//           // Highlight the corresponding dot
//           d3.select(window.leaderboardDots[d.Config])
//             .transition().duration(200)
//             .style("opacity", 1)
//             .attr("r", 8);
          
//           // If the dot is not visible in the current view, scroll to it
//           if (window.leaderboardTransform) {
//             // TODO: You could add auto-panning to the highlighted dot here
//           }
//         }
//       })
//       .on("mouseout", function() {
//         // Return all dots to normal if leaderboard chart exists
//         if (window.leaderboardDots) {
//           d3.selectAll(".dot")
//             .transition().duration(200)
//             .style("opacity", 1)
//             .attr("r", 5);
//         }
//       });
//     }
    
//     // Add model name cell
//     rows.append("td")
//       .text(d => d.Display_Name)
//       .style("color", d => window.leaderboardColors ? window.leaderboardColors[d.Model_Group] : null);
    
//     // Add paper link cell
//     rows.append("td")
//       .append("a")
//       .attr("href", d => d.Paper_URL || "#")
//       .attr("target", "_blank")
//       .text(d => d.Paper_URL ? "📄" : "")
//       .style("text-decoration", "none");
    
//     // Add code link cell
//     rows.append("td")
//       .append("a")
//       .attr("href", d => d.Code_URL || "#")
//       .attr("target", "_blank")
//       .text(d => d.Code_URL ? "💻" : "")
//       .style("text-decoration", "none");
    
//     // Add performance cell
//     rows.append("td")
//       .text(d => {
//         if (d.performance != null) {
//           return d.performance.toFixed(1) + '%';
//         } else {
//           return 'N/A';
//         }
//       });
    
//     // Add cost cell
//     rows.append("td")
//       .text(d => {
//         if (d.cost == null) {
//           return 'N/A';
//         } else if (d.cost < 1) {
//           return '$' + d.cost.toFixed(3);
//         } else if (d.cost < 1000) {
//           return '$' + d.cost.toFixed(2);
//         } else {
//           return '$' + (d.cost/1000).toFixed(1) + 'K';
//         }
//       });
//   }
  
//   // Function to load data
//   function loadData() {
//     d3.csv(dataUrl).then(data => {
//       // Process data
//       data.forEach(d => {
//         // Convert all score and cost columns to numbers
//         // v2 columns
//         d.v2_Public_Eval_Score = d.v2_Public_Eval_Score ? +d.v2_Public_Eval_Score : null;
//         d.v2_Public_Eval_Cost_Per_Task = d.v2_Public_Eval_Cost_Per_Task ? +d.v2_Public_Eval_Cost_Per_Task : null;
//         d.v2_Semi_Private_Score = d.v2_Semi_Private_Score ? +d.v2_Semi_Private_Score : null;
//         d.v2_Semi_Private_Cost_Per_Task = d.v2_Semi_Private_Cost_Per_Task ? +d.v2_Semi_Private_Cost_Per_Task : null;
//         d.v2_Private_Eval_Score = d.v2_Private_Eval_Score ? +d.v2_Private_Eval_Score : null;
//         d.v2_Private_Eval_Cost_Per_Task = d.v2_Private_Eval_Cost_Per_Task ? +d.v2_Private_Eval_Cost_Per_Task : null;
        
//         // v1 columns
//         d.v1_Public_Eval_Score = d.v1_Public_Eval_Score ? +d.v1_Public_Eval_Score : null;
//         d.v1_Public_Eval_Cost_Per_Task = d.v1_Public_Eval_Cost_Per_Task ? +d.v1_Public_Eval_Cost_Per_Task : null;
//         d.v1_Semi_Private_Score = d.v1_Semi_Private_Score ? +d.v1_Semi_Private_Score : null;
//         d.v1_Semi_Private_Cost_Per_Task = d.v1_Semi_Private_Cost_Per_Task ? +d.v1_Semi_Private_Cost_Per_Task : null;
//         d.v1_Private_Eval_Score = d.v1_Private_Eval_Score ? +d.v1_Private_Eval_Score : null;
//         d.v1_Private_Eval_Cost_Per_Task = d.v1_Private_Eval_Cost_Per_Task ? +d.v1_Private_Eval_Cost_Per_Task : null;
        
//         // Convert display string to boolean
//         d.display = d.display === "true" || d.display === "True" || d.display === true;
//       });
      
//       window.leaderboardData = data;
      
//       // Process and display with the selected data source
//       processAndDisplayData(data);
//     });
//   }
  
//   // Check if leaderboard data is already available
//   if (window.leaderboardData) {
//     processAndDisplayData(window.leaderboardData);
//   } else {
//     // If chart hasn't loaded data yet, listen for the event
//     document.addEventListener('leaderboardChartReady', function(e) {
//       processAndDisplayData(e.detail);
//     }, { once: true });
    
//     // Also load data directly in case chart is not used
//     loadData();
//   }
// } 