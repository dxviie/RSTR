self.onmessage = function(e) {
    const { sharedBuffer, clusterBuffer, width, height, startRow, endRow, centroids } = e.data;
    const inputArray = new Uint8ClampedArray(sharedBuffer);
    const clusterArray = new Int32Array(clusterBuffer);
    const k = centroids.length;

    function colorDistance(c1, c2) {
        return Math.sqrt(
            Math.pow(c1[0] - c2[0], 2) +
            Math.pow(c1[1] - c2[1], 2) +
            Math.pow(c1[2] - c2[2], 2)
        );
    }

    for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const pixel = [inputArray[idx], inputArray[idx + 1], inputArray[idx + 2]];
            
            let minDist = Infinity;
            let closestCentroid = 0;
            
            for (let j = 0; j < k; j++) {
                const dist = colorDistance(pixel, centroids[j]);
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = j;
                }
            }
            
            clusterArray[y * width + x] = closestCentroid;
        }
    }

    self.postMessage('done');
};