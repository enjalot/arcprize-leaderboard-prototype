const points_to_show_on_table = ['gemini-2.5-pro-exp-03-25'];

async function loadData(csvLocation) {
  return await d3.csv(csvLocation, d3.autoType)
}

function filterData(data) {
  return data.filter(d => {
    // If the Config is in points_to_show_on_table, show it regardless of display value
    if (points_to_show_on_table.includes(d.Config)) return true;

    // Apparent bug in gpt-4o v1 score has it as the percent display value instead of 0-1 score
    if(d.v1_Semi_Private_Score > 1) d.v1_Semi_Private_Score = d.v1_Semi_Private_Score/100
    
    // Otherwise, check display status
    if(!d.display) return false
    
    // Filter out entries with no score or cost
    if (d.v2_Semi_Private_Score === null || isNaN(d.v2_Semi_Private_Score)) return false;
    if (d.v2_Semi_Private_Cost_Per_Task === null || isNaN(d.v2_Semi_Private_Cost_Per_Task)) return false;
    return true
  }).sort((a, b) => {
    // Handle null values by placing them at the end
    if (a.v2_Semi_Private_Score === null) return 1;
    if (b.v2_Semi_Private_Score === null) return -1;
    // Sort in descending order
    return b.v2_Semi_Private_Score - a.v2_Semi_Private_Score;
  })
}

function tidyData(data) {
  return data.flatMap(d => {
    return [
      {...d, version: "ARC-AGI-1", score: d.v1_Semi_Private_Score * 100, cost: d.v1_Semi_Private_Cost_Per_Task},
      {...d, version: "ARC-AGI-2", score: d.v2_Semi_Private_Score * 100, cost: d.v2_Semi_Private_Cost_Per_Task},
    ]
  }).filter(d => d.cost > 0 && d.score > 0)
}