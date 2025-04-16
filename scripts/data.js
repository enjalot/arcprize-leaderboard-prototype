// Global variables for data
let datasets = [];
let models = [];
let providers = [];
let evaluations = [];

// Object versions with id as key
let datasetsById = {};
let modelsById = {};
let providersById = {};

const points_to_show_on_table = ['gemini-2.5-pro-exp-03-25'];

// Load all JSON data files
async function loadAllData() {
  try {
    // Load all data files in parallel
    const [datasetsData, modelsData, providersData, evaluationsData] = await Promise.all([
      d3.json('data/datasets.json'),
      d3.json('data/models.json'),
      d3.json('data/providers.json'),
      d3.json('data/evaluations.json')
    ]);
    
    // Assign to global variables
    datasets = datasetsData;
    models = modelsData;
    providers = providersData;
    evaluations = evaluationsData.filter(d => {
      return d.costPerTask > 0 && d.score > 0 && d.display
    });
    
    // Create object versions with id as key
    datasetsById = createObjectById(datasets);
    modelsById = createObjectById(models);
    providersById = createObjectById(providers);
    
    // Return the evaluations data directly as tidyData
    return evaluations;
  } catch (error) {
    console.error("Error loading data:", error);
    return [];
  }
}

// Helper function to convert array to object with id as key
function createObjectById(array) {
  return array.reduce((obj, item) => {
    obj[item.id] = item;
    return obj;
  }, {});
}

// Legacy function for backward compatibility
async function loadData(csvLocation) {
  console.warn("loadData is deprecated. Use loadAllData instead.");
  return await d3.csv(csvLocation, d3.autoType);
}

// These functions are maintained for compatibility but now just return the data directly
function filterData(data) {
  console.warn("filterData is deprecated. Data is now pre-filtered in evaluations.json");
  return data;
}

function tidyData(data) {
  console.warn("tidyData is deprecated. Data is now pre-tidied in evaluations.json");
  return evaluations;
}