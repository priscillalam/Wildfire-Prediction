import colorsys
import pyproj
import glob
import json
import math
import matplotlib.pyplot as plot
import csv
import sys
from PIL import Image, ImageDraw

YEAR_START = 2003
YEAR_END = 2019

BOTTOM_LEFT_LAT = 32
BOTTOM_LEFT_LNG = -125
TOP_RIGHT_LAT = 42
TOP_RIGHT_LNG = -114

OCEAN_EXCLUSION_RANGE = [0.5, 0.8]

EPSG_4326 = pyproj.Proj('EPSG:4326')
EPSG_3785 = pyproj.Proj('EPSG:3785')

BOTTOM_LEFT_EPSG_3785 = pyproj.transform(EPSG_4326, EPSG_3785, BOTTOM_LEFT_LAT, BOTTOM_LEFT_LNG)
TOP_RIGHT_EPSG_3785 = pyproj.transform(EPSG_4326, EPSG_3785, TOP_RIGHT_LAT, TOP_RIGHT_LNG)

REFERENCE_IMAGE_WIDTH_PX = 3998
REFERENCE_IMAGE_HEIGHT_PX = 4551

METERS_PER_PIXEL_X =  (TOP_RIGHT_EPSG_3785[0] - BOTTOM_LEFT_EPSG_3785[0]) / (REFERENCE_IMAGE_WIDTH_PX)
METERS_PER_PIXEL_Y = (TOP_RIGHT_EPSG_3785[1] - BOTTOM_LEFT_EPSG_3785[1]) / (REFERENCE_IMAGE_HEIGHT_PX)

SAMPLE_SIZE_X = 3
SAMPLE_SIZE_Y = 3
SIGNIFICANCE_THRESHOLD_PX = 20

AVERAGES_DATA_FILE = "output/averages.txt"
AVERAGES_GRAPH = "output/averages.png"
PREDICTION_IMAGE = "output/prediction.bmp"

def pixelToCoordinate(x, y):
    epsg3785X = (TOP_RIGHT_EPSG_3785[0] - BOTTOM_LEFT_EPSG_3785[0]) * (x / REFERENCE_IMAGE_WIDTH_PX) + BOTTOM_LEFT_EPSG_3785[0]
    epsg3785Y = (TOP_RIGHT_EPSG_3785[1] - BOTTOM_LEFT_EPSG_3785[1]) * (y / REFERENCE_IMAGE_HEIGHT_PX) + BOTTOM_LEFT_EPSG_3785[1]
    return pyproj.transform(EPSG_3785, EPSG_4326, epsg3785X, epsg3785Y)

def coordinateToPixel(lat, lng):
    epsg3785X = pyproj.transform(EPSG_4326, EPSG_3785, lat, lng)[0]
    epsg3785Y = pyproj.transform(EPSG_4326, EPSG_3785, lat, lng)[1]

    pX = REFERENCE_IMAGE_WIDTH_PX * (epsg3785X - BOTTOM_LEFT_EPSG_3785[0]) / (TOP_RIGHT_EPSG_3785[0] - BOTTOM_LEFT_EPSG_3785[0])
    pY = REFERENCE_IMAGE_HEIGHT_PX * (epsg3785Y - BOTTOM_LEFT_EPSG_3785[1]) / (TOP_RIGHT_EPSG_3785[1] - BOTTOM_LEFT_EPSG_3785[1])
    return (pX, pY)

def openImage(year):
    files = glob.glob('./images/*' + year + '*.png')
    if len(files) == 0:
        raise Exception("Can't find image file for " + str(year))
    image = Image.open(files[0])
    pixels = image.load()
    return pixels

def parseJson(year):
    files = glob.glob('./json/*' + year + '*.json')
    if len(files) == 0:
        raise Exception("Can't find JSON file for " + str(year))
    file = open(files[0])
    fireInfo = json.load(file)
    locations = [location for location in list(zip(fireInfo['fire_lats'], fireInfo['fire_lons'])) if isLocationInBounds(location)]
    pixelLocations = [coordinateToPixel(location[0], location[1]) for location in locations]
    return pixelLocations

def processImage(image, fireLocations, buckets, counts):
    currentX = 0
    currentY = 0

    data = []
    while (currentX + SAMPLE_SIZE_X) <= REFERENCE_IMAGE_WIDTH_PX and (currentY + SAMPLE_SIZE_Y) <= REFERENCE_IMAGE_HEIGHT_PX:
        colorVectorSum = [0, 0, 0]
        for x in range(currentX, currentX + SAMPLE_SIZE_X):
            for y in range(currentY, currentY + SAMPLE_SIZE_Y):
                colorVectorSum[0] += image[x, y][0]
                colorVectorSum[1] += image[x, y][1]
                colorVectorSum[2] += image[x, y][2]
        colorVectorAverage = [element / (SAMPLE_SIZE_X * SAMPLE_SIZE_Y) for element in colorVectorSum]
        hue = round(colorsys.rgb_to_hsv(colorVectorAverage[0], colorVectorAverage[1], colorVectorAverage[2])[0], 2)
        centerOfSampleX = currentX + SAMPLE_SIZE_X / 2
        centerOfSampleY = currentY + SAMPLE_SIZE_Y / 2
        minDistance = min([distanceInMeters(location, (centerOfSampleX, centerOfSampleY)) for location in fireLocations])

        if hue not in buckets:
            counts[hue] = 1
            buckets[hue] = minDistance
        else:
            counts[hue] += 1
            buckets[hue] += minDistance

        currentX += 1

        if (currentX + SAMPLE_SIZE_X) > REFERENCE_IMAGE_WIDTH_PX:
            currentX = 0
            currentY += 1

def distanceInMeters(px1, px2):
    deltaXMeters = (px1[0] - px2[0]) * METERS_PER_PIXEL_X
    deltaYMeters = (px1[1] - px2[1]) * METERS_PER_PIXEL_Y
    return math.sqrt(deltaXMeters ** 2 + deltaYMeters ** 2)

def isLocationInBounds(coordinate):
    if coordinate[0] >= BOTTOM_LEFT_LAT and coordinate[0] <= TOP_RIGHT_LAT and coordinate[1] >= BOTTOM_LEFT_LNG and coordinate[1] <= TOP_RIGHT_LNG:
        return True
    return False

def process():
    xVector = []
    yVector = []

    buckets = {}
    counts = {}

    for year in range(YEAR_START, YEAR_END):
        print("Adding data from " + str(year))
        processImage(openImage(str(year)), parseJson(str(year)), buckets, counts)

    for key, value in buckets.items():
        xVector += [key]
        yVector += [value / counts[key]]

    with open(AVERAGES_DATA_FILE, 'w') as file:
        writer = csv.writer(file)
        writer.writerows(zip(xVector, yVector))

    plot.scatter(xVector, yVector)
    plot.savefig(AVERAGES_GRAPH)

# 1 when distance is 0, 0 when distance is 500000m
def distanceToAlpha(distance):
    return -1 / 100000 * distance + 1

def predict():
    hueToAlpha = {}
    dataFile = open(AVERAGES_DATA_FILE)
    line = dataFile.readline()
    while line:
        pair = line.split(',')
        if len(pair) != 2:
            continue
        hue = float(pair[0])
        hueAlpha = distanceToAlpha(float(pair[1]))
        hueToAlpha[hue] = hueAlpha
        line = dataFile.readline()

    bitmap = Image.new('RGBA', (REFERENCE_IMAGE_WIDTH_PX, REFERENCE_IMAGE_HEIGHT_PX), (0, 0, 0, 0))
    output = bitmap.load()
    pixels = openImage(str(YEAR_END))

    for x in range(REFERENCE_IMAGE_WIDTH_PX):
        for y in range(REFERENCE_IMAGE_HEIGHT_PX):
            pixel = pixels[x, y]
            hue = round(colorsys.rgb_to_hsv(pixel[0], pixel[1], pixel[2])[0], 2)
            if hue in hueToAlpha and not (hue > OCEAN_EXCLUSION_RANGE[0] and hue <= OCEAN_EXCLUSION_RANGE[1]):
                alpha = hueToAlpha[hue]
            else:
                alpha = 0
            output[x, y] = (255, 0, 255, int(alpha * 255))

    fires = parseJson(str(YEAR_END))[0:20]

    background = Image.open(glob.glob('./images/*' + str(YEAR_END) + '*.png')[0]).convert('RGBA')
    background.paste(bitmap, (0,0), bitmap)

    draw = ImageDraw.Draw(background)

    for fire in fires:
        draw.ellipse((fire[0] - 25, (REFERENCE_IMAGE_HEIGHT_PX - (fire[1] + 25)), fire[0] + 25, (REFERENCE_IMAGE_HEIGHT_PX - (fire[1] - 25))), fill=(199, 0, 57))
    background.save(PREDICTION_IMAGE)

if len(sys.argv) >= 2 and sys.argv[1] == "predict":
    predict()
elif len(sys.argv) >= 2 and sys.argv[1] == "process":
    process()
