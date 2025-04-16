// -----------------------------------------
// Refactored Table Generator using new data structures
// -----------------------------------------
function createLeaderboardTable(containerId) {
  // Get container and add class using D3
  const container = d3.select(`#${containerId}`)
    .classed('leaderboard-table', true);

  // Check if data is already loaded
  if (evaluations && evaluations.length > 0) {
    processAndBuildTable();
  } else {
    // If data is not yet loaded, load it
    loadAllData().then(() => {
      processAndBuildTable();
    }).catch(err => {
      console.error("Error loading evaluation data:", err);
    });
  }

  // Process data and build the table
  function processAndBuildTable() {
    // Group evaluations by modelId and dataset version
    const modelEvaluations = {};
    
    evaluations.forEach(eval => {
      const modelId = eval.modelId;
      const datasetId = eval.datasetId;
      
      // Skip evaluations that don't match our semi-private datasets
      if (!versions.includes(datasetId)) {
        return;
      }
      
      // Initialize if first time seeing this model
      if (!modelEvaluations[modelId]) {
        modelEvaluations[modelId] = {
          modelId: modelId,
          model: modelsById[modelId] || {},
          provider: modelsById[modelId] ? providersById[modelsById[modelId].providerId] : {},
          evaluations: {}
        };
      }
      
      // Store evaluation by dataset version
      modelEvaluations[modelId].evaluations[datasetId] = eval;
    });

    console.log("modelEvaluations", modelEvaluations)
    
    // Convert to array and filter for display
    const tableData = Object.values(modelEvaluations).filter(item => {
      // Always show specific models
      if (points_to_show_on_table.includes(item.modelId)) {
        return true;
      }
            
      return true;
    });
    
    // Sort data by v2 score (high to low)
    tableData.sort((a, b) => {
      const scoreA = a.evaluations[versions[1]] ? a.evaluations[versions[1]].score : 0;
      const scoreB = b.evaluations[versions[1]] ? b.evaluations[versions[1]].score : 0;
      return scoreB - scoreA;
    });

    // Build the table using D3
    buildTableWithD3(tableData);
  }

  // Build the table using D3
  function buildTableWithD3(data) {
    // Clear container
    container.html("");
    
    // Define columns
    const columns = [
      { key: "model", label: "AI System", sortable: true },
      { key: "org", label: "Organization", sortable: true },
      { key: "systemType", label: "System Type", sortable: true },
      { key: "score-1", label: "ARC-AGI-1", sortable: true },
      { key: "score-2", label: "ARC-AGI-2", sortable: true },
      { key: "cost", label: "Cost/Task", sortable: true },
      { key: "links", label: "Code / Paper", sortable: false }
    ];
    
    // Create table structure
    const table = container.append("table")
      .attr("class", "data-table table table-striped");
      
    const thead = table.append("thead");
    const tbody = table.append("tbody");
    
    // Create header row
    thead.append("tr")
      .selectAll("th")
      .data(columns)
      .enter()
      .append("th")
      .text(d => d.label)
      .attr("data-sort", d => d.sortable ? d.key : null)
      .style("cursor", d => d.sortable ? "pointer" : null)
      .style("background-color", d => d.key === "score-2" ? "#e53aa3cf" : null);
    
    // Create rows
    const rows = tbody.selectAll("tr")
      .data(data)
      .enter()
      .append("tr")
      .attr("data-model-id", d => d.modelId)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        if (window.leaderboardDots && window.leaderboardDots[d.modelId]) {
          // Implement hover effect here
        }
      });
    
    // Add cells to each row
    rows.each(function(d) {
      const row = d3.select(this);
      const model = d.model;
      const provider = d.provider;
      const v1Eval = d.evaluations[versions[0]];
      const v2Eval = d.evaluations[versions[1]];
      
      // Extract data
      const modelName = model.displayName || model.id || "N/A";
      const orgName = provider.displayName || "N/A";
      const systemType = model.modelType || "N/A";
      
      // Format v1 score
      let finalScoreV1 = "N/A";
      if (v1Eval && v1Eval.score !== null) {
        const score = v1Eval.score;
        const displayScore = (score > 0 && score <= 1) ? score * 100 : score;
        finalScoreV1 = displayScore.toFixed(1) + "%";
      }
      
      // Format v2 score
      let finalScoreV2 = "N/A";
      if (v2Eval && v2Eval.score !== null) {
        const score = v2Eval.score;
        const displayScore = (score > 0 && score <= 1) ? score * 100 : score;
        finalScoreV2 = displayScore.toFixed(1) + "%";
      }
      
      // Format cost
      let finalCost = "N/A";
      let cost = v2Eval?.costPerTask || v1Eval?.costPerTask;
      if (cost !== null) {
        if (cost < 1) {
          finalCost = "$" + cost.toFixed(3);
        } else if (cost < 1000) {
          finalCost = "$" + cost.toFixed(2);
        } else {
          finalCost = "$" + (cost / 1000).toFixed(1) + "K";
        }
      }
      
      // Add model cell with color styling
      row.append("td")
        .text(modelName)
        .style("color", () => {
          if (window.leaderboardColors && model.modelGroup) {
            return window.leaderboardColors[model.modelGroup] || '';
          }
          return null;
        });
      
      // Add org cell
      row.append("td").text(orgName);
      
      // Add system type cell
      row.append("td").text(systemType);
      
      // Add score cells
      row.append("td").text(finalScoreV1);
      row.append("td").text(finalScoreV2);
      
      // Add cost cell
      row.append("td").text(finalCost);
      
      // Add links cell with SVG icons instead of emojis
      const linksCell = row.append("td");
      
      if (model.paperUrl) {
        linksCell.append("a")
          .attr("href", model.paperUrl)
          .attr("target", "_blank")
          .style("margin-right", "8px")
          .style("font-size", "14px")
          .html(`📄`);
      }
      
      if (model.codeUrl) {
        linksCell.append("a")
          .attr("href", model.codeUrl)
          .attr("target", "_blank")
          .style("margin-right", "8px")
          .style("font-size", "14px")
          .html(`💻`);
      }
      
      if (!model.paperUrl && !model.codeUrl) {
        linksCell.text("—");
      }
    });
  }
}
 