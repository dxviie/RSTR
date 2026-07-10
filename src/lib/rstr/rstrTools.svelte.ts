// @ts-nocheck — /classic legacy code — kept for nostalgia, intentionally left as-is and not type-checked.
function findValidNeighbors(blocks, block) {
	let neighbors = [];
	let x = block.gridX;
	let y = block.gridY;
	let xSpan = block.xSpan;
	let ySpan = block.ySpan;
	for (let i = 0; i < blocks.length; i++) {
		let neighbor = blocks[i];
		if (neighbor.gridX === x && neighbor.gridY === y) {
			continue;
		}
		if (
			(neighbor.gridX === x &&
				neighbor.gridY >= y &&
				neighbor.gridY <= y + ySpan &&
				neighbor.xSpan === xSpan) ||
			(neighbor.gridY === y &&
				neighbor.gridX >= x &&
				neighbor.gridX <= x + xSpan &&
				neighbor.ySpan === ySpan)
		) {
			if (!neighbor.used) {
				neighbors.push(neighbor);
			}
		}
	}
	return neighbors;
}
