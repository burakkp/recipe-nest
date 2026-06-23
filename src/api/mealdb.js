// TheMealDB layer — swap this file to migrate recipe providers.
const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

export const CATEGORIES = [
  'Beef',
  'Chicken',
  'Seafood',
  'Pasta',
  'Dessert',
  'Vegetarian',
  'Breakfast',
];

// TheMealDB stores ingredients/measures as 20 numbered fields instead of an array.
function normalizeIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      ingredients.push({ name: name.trim(), measure: (measure || '').trim() });
    }
  }
  return ingredients;
}

function normalizeSteps(instructions) {
  if (!instructions) return [];
  return instructions
    .split('\r\n')
    .join('\n')
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean);
}

function toDetail(meal) {
  return {
    id: meal.idMeal,
    title: meal.strMeal,
    thumb: meal.strMealThumb,
    category: meal.strCategory,
    area: meal.strArea,
    ingredients: normalizeIngredients(meal),
    instructions: meal.strInstructions || '',
    steps: normalizeSteps(meal.strInstructions),
    source: meal.strSource || meal.strYoutube || '',
  };
}

export async function fetchByCategory(category) {
  const res = await fetch(`${BASE_URL}/filter.php?c=${encodeURIComponent(category)}`);
  const data = await res.json();
  return (data.meals || []).map((meal) => ({
    id: meal.idMeal,
    title: meal.strMeal,
    thumb: meal.strMealThumb,
  }));
}

export async function fetchRecipeById(id) {
  const res = await fetch(`${BASE_URL}/lookup.php?i=${encodeURIComponent(id)}`);
  const data = await res.json();
  const meal = data.meals && data.meals[0];
  return meal ? toDetail(meal) : null;
}

// search.php returns full meal records (unlike filter.php), so we normalize
// to the same detail shape — search results can skip the lookup round-trip.
export async function searchRecipes(term) {
  const res = await fetch(`${BASE_URL}/search.php?s=${encodeURIComponent(term)}`);
  const data = await res.json();
  return (data.meals || []).map(toDetail);
}
