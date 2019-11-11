import csv
import numpy
import os
from dateutil.parser import parse
from enum import Enum

# The cause of the fire
class Cause(Enum):
    Unknown = 0
    Natural = 1
    Human = 2

class Fire:
    def __init__(self, dictionary):
        self.latitude = float(dictionary['latitude'])
        self.longitude = float(dictionary['longitude'])
        self.discovery_date = dictionary['discovery_date']
        self.stat_cause_code = int(dictionary['stat_cause_code'])
        self.acres = float(dictionary['fire_size'])

        cont_date = dictionary['cont_date']
        discovery_date = dictionary['discovery_date']
        date = cont_date if (discovery_date == None or discovery_date == "") \
            else discovery_date
        parsed_date = parse(date)

        self.year = parsed_date.year
        self.month = parsed_date.month

    def get_cause(self):
        stat_cause_code = self.stat_cause_code
    
        if stat_cause_code == 1:
            return Cause.Natural
        elif stat_cause_code == 13 or stat_cause_code == None or stat_cause_code == "":
            return Cause.Unknown
        elif stat_cause_code >= 2 or stat_cause_code <= 12:
            return Cause.Human

class Aggregator:
    class Key:
        def __init__(self, latitude, longitude, month, year):
            self.latitude = latitude
            self.longitude = longitude
            self.month = month
            self.year = year

        def __eq__(self, other):
            return self.latitude == other.latitude and \
                self.longitude == other.longitude and \
                self.month == other.month and \
                self.year == other.year

        def __hash__(self):
            return hash((self.latitude, self.longitude, self.month, self.year))

    class Bucket:
        def __init__(self):
            self.natural_acres_burned = 0
            self.human_acres_burned = 0
            self.unknown_acres_burned = 0

        def add_data(self, cause, acres_burned):
            if cause == Cause.Natural:
                self.natural_acres_burned += acres_burned
            elif cause == Cause.Human:
                self.human_acres_burned += acres_burned
            else:
                self.unknown_acres_burned += acres_burned

    def __init__(self):
        self.buckets = dict()

    # Rounds the coordinates to the nearest 0.5 degrees
    def round_coordinate(self, coordinate, step_size=0.5):
        return numpy.floor(coordinate / step_size) * step_size

    def bucket_fire(self, fire):
        new_latitude = self.round_coordinate(fire.latitude)
        new_longitude = self.round_coordinate(fire.longitude)
        month = fire.month
        year = fire.year
        cause = fire.get_cause()
        acres = fire.acres

        key = Aggregator.Key(new_latitude, new_longitude, month, year)
        if key not in self.buckets:
            self.buckets[key] = Aggregator.Bucket()

        self.buckets[key].add_data(cause, acres)

    def to_dictionary_list(self):
        dictionaries = []
        for key in self.buckets:
            dictionary = {
              'latitude': float(key.latitude),
              'longitude': float(key.longitude),
              'year': int(key.year),
              'month': int(key.month),
              'natural_acres_burned': float(self.buckets[key].natural_acres_burned),
              'human_acres_burned': float(self.buckets[key].human_acres_burned),
              'unknown_acres_burned': float(self.buckets[key].unknown_acres_burned)
            }
            dictionaries.append(dictionary)
        return dictionaries

def write_dictionary_list(dictionary_list, file_name):
    if len(dictionary_list) == 0:
        return
    keys = dictionary_list[0].keys()
    with open(file_name, 'w') as output_file:
        dict_writer = csv.DictWriter(output_file, keys)
        dict_writer.writeheader()
        dict_writer.writerows(dictionary_list)

# Open the CSV specified and bucket each fire to its corresponding location.
def aggregate_fires_from_file(aggregator, file_name):
    with open(file_name) as csv_file:
        csv_reader = csv.DictReader(csv_file)
        line_count = 0
        for row in csv_reader:
            fire = Fire(row)
            aggregator.bucket_fire(fire)

def process_csvs(input_file_names, output_file_name):
    aggregator = Aggregator()
    for file_name in input_file_names:
        aggregate_fires_from_file(aggregator, file_name)
    write_dictionary_list(aggregator.to_dictionary_list(), output_file_name)
