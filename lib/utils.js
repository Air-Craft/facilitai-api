

module.exports = {
  extractStringVariants	
}

function extractStringVariants(processes, field) {
	const all = processes.map( item => item[field].replace(/\s+/g, ''))
	const unique = all.filter((item, index) =>
    all.indexOf(item) === index && item !== ''
	)
	return unique
}