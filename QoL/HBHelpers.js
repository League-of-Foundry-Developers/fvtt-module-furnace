
H.registerHelpers(Handlebars)
Handlebars.registerHelper({
    now: () => new Date(),
    roll: (formula) => new Roll(formula).roll().total,
    multiply: (value1, value2) => Number(value1) * Number(value2),
    divide: (value1, value2) => Number(value1) / Number(value2),
    idx: (array, idx) => array && array.length > idx ? array[idx] : ""
});