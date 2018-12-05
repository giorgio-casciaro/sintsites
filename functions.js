
const objMap = (obj, func) => Object.keys(obj).reduce((newObj, key) => { newObj[key] = func(obj[key], key); return newObj }, {})
const objFilter = (obj, func) => Object.keys(obj).reduce((newObj, key) => { if (func(obj[key], key))newObj[key] = obj[key]; return newObj }, {})
const objReduce = (obj, func, acc) => Object.keys(obj).reduce((acc, key) => func(acc, obj[key], key), acc)

const arrayToObjBy = (array, prop) => array.reduce((newObj, item) => { newObj[item[prop]] = item; return newObj }, {})
const objByToArray = (obj, prop) => Object.keys(obj).reduce((newArray, key) => { newArray.push(obj[key]); return newArray }, [])

const arrayUnique = (array) => array.filter((v, i, a) => a.indexOf(v) === i)
const objArrayExtract = (items, propName) => items.reduce((results, item) => results.push(item[propName]), [])
