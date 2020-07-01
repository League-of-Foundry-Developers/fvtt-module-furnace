
H.registerHelpers(Handlebars)
Handlebars.registerHelper({
    now: () => new Date(),
    roll: function (formula) {
        if (formula.name === "roll") return this.roll;
        return new Roll(formula).roll().total
    },
    multiply: (value1, value2) => Number(value1) * Number(value2),
    divide: (value1, value2) => Number(value1) / Number(value2),
    idx: function (array, idx) {
      if (array.name === "idx") return this.idx;
      return array && array.length > idx ? array[idx] : ""
    }
});