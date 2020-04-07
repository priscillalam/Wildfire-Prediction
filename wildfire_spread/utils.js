function rgb2hsv(r, g, b) {
    let rabs, gabs, babs, rr, gg, bb, h, s, v, diff, diffc, percentRoundFn;
    rabs = r / 255;
    gabs = g / 255;
    babs = b / 255;
    v = Math.max(rabs, gabs, babs),
    diff = v - Math.min(rabs, gabs, babs);
    diffc = c => (v - c) / 6 / diff + 1 / 2;
    percentRoundFn = num => Math.round(num * 100) / 100;
    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(rabs);
        gg = diffc(gabs);
        bb = diffc(babs);

        if (rabs === v) {
            h = bb - gg;
        } else if (gabs === v) {
            h = (1 / 3) + rr - bb;
        } else if (babs === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        }else if (h > 1) {
            h -= 1;
        }
    }
    return {
        h: Math.round(h * 360),
        s: percentRoundFn(s * 100),
        v: percentRoundFn(v * 100)
    };
}

function hsvOfPixel(patch, x, y) {
    let patchImageDataStartIndex = 4 * (y * IMAGE_WIDTH + x);
    let red = patch.data[patchImageDataStartIndex];
    let green = patch.data[patchImageDataStartIndex + 1];
    let blue = patch.data[patchImageDataStartIndex + 2];
    let hsv = rgb2hsv(red, green, blue);
    return hsv;
}

function getFuel(hsv) {
    return MAX_FUEL * (MAX_HUE_DELTA - (Math.abs(BURNABLE_AREA_HUE - hsv.h))) / MAX_HUE_DELTA;
}

function distanceInMiles(lat1, lng1, lat2, lng2) {
    if ((lat1 == lat2) && (lng1 == lng2)) {
        return 0;
    } else {
        let radlat1 = Math.PI * lat1/180;
        let radlat2 = Math.PI * lat2/180;
        let theta = lng1 - lng2;
        let radtheta = Math.PI * theta/180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180/Math.PI;
        dist = dist * 60 * 1.1515;
        return dist;
    }
}

function sharpenImage(context, w, h, amount) {
    let x, sx, sy, r, g, b, a, dstOff, srcOff, wt, cx, cy, scy, scx,
        weights = [0, -1, 0, -1, 5, -1, 0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        dstData = context.createImageData(w, h),
        dstBuff = dstData.data,
        srcBuff = context.getImageData(0, 0, w, h).data,
        y = h;

    while (y--) {
        x = w;
        while (x--) {
            sy = y;
            sx = x;
            dstOff = (y * w + x) * 4;
            r = 0;
            g = 0;
            b = 0;
            a = 0;

            for (cy = 0; cy < katet; cy++) {
                for (cx = 0; cx < katet; cx++) {
                    scy = sy + cy - half;
                    scx = sx + cx - half;

                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                        srcOff = (scy * w + scx) * 4;
                        wt = weights[cy * katet + cx];

                        r += srcBuff[srcOff] * wt;
                        g += srcBuff[srcOff + 1] * wt;
                        b += srcBuff[srcOff + 2] * wt;
                        a += srcBuff[srcOff + 3] * wt;
                    }
                }
            }

            dstBuff[dstOff] = r * amount + srcBuff[dstOff] * (1 - amount);
            dstBuff[dstOff + 1] = g * amount + srcBuff[dstOff + 1] * (1 - amount);
            dstBuff[dstOff + 2] = b * amount + srcBuff[dstOff + 2] * (1 - amount);
            dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
        }
    }

    context.putImageData(dstData, 0, 0);
}

function areAnyNeighborsBurning(state, pixelX, pixelY) {
    for (let x = pixelX - 1; x <= pixelX + 1; x++) {
        for (let y = pixelY - 1; y <= pixelY + 1; y++) {
            if (x >= 0 && x < IMAGE_WIDTH && y >= 0 && y < IMAGE_HEIGHT &&
                (pixelX != x || pixelY != y)) {
                if (state[x][y].isBurning()) {
                    return state[x][y].burnRate;
                }
            }
        }
    }
    return 0;
}
