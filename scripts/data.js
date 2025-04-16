// Global variables for data
let versions = ['v1_Semi_Private', 'v2_Semi_Private'];
// let versions = ['v1_Public_Eval', 'v2_Public_Eval'];
// let versions = ['v1_Private_Eval', 'v2_Private_Eval'];
let modelGroups = {
"v1_Semi_Private": ["o3", "Claude_3_7_thinking", "o3-mini", "o1", "gpt-4.1"],
"v2_Semi_Private": ["o3", "Claude_3_7_thinking", "o3-mini", "o1", "gpt-4.1"]
}
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
      return versions.includes(d.datasetId)
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
