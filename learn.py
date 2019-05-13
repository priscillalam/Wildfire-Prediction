import csv
import numpy
from sklearn import linear_model

NUMBER_OF_MONTHS_IN_YEAR = 12

def months_from_peak_season(month, peak_fire_season):
    return abs(month - PEAK_FIRE_SEASON)

class FireDate:
    def __init__(self, year, month):
        self.year = year
        self.month = month

class FireData:
    def __init__(self, first_year_in_dataset, last_year_in_dataset):
        self.first_year_in_dataset = first_year_in_dataset
        self.last_year_in_dataset = last_year_in_dataset
        self.natural_acres_burned_vector = self.create_vector()
        self.human_acres_burned_vector = self.create_vector()
        self.unknown_acres_burned_vector = self.create_vector()

    def create_vector(self):
        return [0] * (self.last_year_in_dataset - self.first_year_in_dataset + 1) * \
            NUMBER_OF_MONTHS_IN_YEAR

    def calculate_array_index(self, year, month):
        year_offset = year - self.first_year_in_dataset
        return year_offset * NUMBER_OF_MONTHS_IN_YEAR + (month - 1)

    def date_from_index(self, index):
        year_offset = int(index / NUMBER_OF_MONTHS_IN_YEAR)
        month = index % NUMBER_OF_MONTHS_IN_YEAR
        return FireDate(self.first_year_in_dataset + year_offset, month + 1)

    def add_data_point_from_dictionary(self, dictionary):
        month = int(dictionary['month'])
        year = int(dictionary['year'])
        latitude = float(dictionary['latitude'])
        longitude = float(dictionary['longitude'])
        natural_acres_burned = float(dictionary['natural_acres_burned'])
        human_acres_burned = float(dictionary['human_acres_burned'])
        unknown_acres_burned = float(dictionary['unknown_acres_burned'])
        vector_index = self.calculate_array_index(year, month)
        self.natural_acres_burned_vector[vector_index] = natural_acres_burned
        self.human_acres_burned_vector[vector_index] = human_acres_burned
        self.unknown_acres_burned_vector[vector_index] = unknown_acres_burned

    def get_peak_month_from_vector(self, vector):
        fires_per_month = [0] * NUMBER_OF_MONTHS_IN_YEAR
        for month, number_of_fires in enumerate(vector):
            fires_per_month[month % NUMBER_OF_MONTHS_IN_YEAR] += number_of_fires
        return numpy.argmax(fires_per_month)

class LocationKey:
    def __init__(self, dictionary):
        self.latitude = dictionary['latitude']
        self.longitude = dictionary['longitude']

    def __eq__(self, other):
        return self.latitude == other.latitude and self.longitude == other.longitude

    def __hash__(self):
        return hash((self.latitude, self.longitude))

class Predictor:
    class Prediction:
        def __init__(
            self,
            latitude,
            longitude,
            year,
            month,
            natural_acres_burned,
            human_acres_burned,
            unknown_acres_burned
            ):
            self.latitude = latitude
            self.longitude = longitude
            self.year = year
            self.month = month
            self.natural_acres_burned = natural_acres_burned
            self.human_acres_burned = human_acres_burned
            self.unknown_acres_burned = unknown_acres_burned

        def to_dictionary(self):
            return {
                'latitude': float(self.latitude),
                'longitude': float(self.longitude),
                'year': int(self.year),
                'month': int(self.month),
                'natural_acres_burned': float(self.natural_acres_burned),
                'human_acres_burned': float(self.human_acres_burned),
                'unknown_acres_burned': float(self.unknown_acres_burned)
            }

    def __init__(
        self,
        first_year_in_dataset,
        last_year_in_dataset,
        start_year_to_predict,
        end_year_to_predict
        ):
        self.first_year_in_dataset = first_year_in_dataset
        self.last_year_in_dataset = last_year_in_dataset
        self.start_year_to_predict = start_year_to_predict
        self.end_year_to_predict = end_year_to_predict
        self.locations_to_fire_data = dict()

    def add_data_point(self, dictionary):
        location_key = LocationKey(dictionary)
        if location_key not in self.locations_to_fire_data:
            self.locations_to_fire_data[location_key] = \
                FireData(self.first_year_in_dataset, self.last_year_in_dataset)
        self.locations_to_fire_data[location_key].add_data_point_from_dictionary(dictionary)

    def predict(self):
        predictions = []
        for location in self.locations_to_fire_data:
            self.predict_location(predictions, location)
        return [prediction.to_dictionary() for prediction in predictions]

    def predict_location(self, predictions, location):
        fire_data = self.locations_to_fire_data[location]
        predicted_natural_acres_burned_vector = \
            self.predict_vector(fire_data, fire_data.natural_acres_burned_vector)
        predicted_human_acres_burned_vector = \
            self.predict_vector(fire_data, fire_data.human_acres_burned_vector)
        predicted_unknown_acres_burned_vector = \
            self.predict_vector(fire_data, fire_data.unknown_acres_burned_vector)

        predicted_fire_data = FireData(self.start_year_to_predict, self.end_year_to_predict)

        for index in range(len(predicted_natural_acres_burned_vector)):
            date = predicted_fire_data.date_from_index(index)
            natural_acres_burned = predicted_natural_acres_burned_vector[index]
            human_acres_burned = predicted_human_acres_burned_vector[index]
            unknown_acres_burned = predicted_unknown_acres_burned_vector[index]

            if natural_acres_burned == 0 and human_acres_burned == 0 and unknown_acres_burned == 0:
                continue

            predictions.append(Predictor.Prediction(
                location.latitude,
                location.longitude,
                date.year,
                date.month,
                natural_acres_burned,
                human_acres_burned,
                unknown_acres_burned))

    def predict_vector(self, fire_data, vector):
        features = []
        prediction_vector = []
        peak_month = fire_data.get_peak_month_from_vector(vector)

        for index in range(len(vector)):
            date = fire_data.date_from_index(index)
            number_of_months_from_peak = abs(date.month - peak_month)
            features.append([date.year, number_of_months_from_peak])
        
        regressor = linear_model.LinearRegression()
        regressor.fit(features, vector)

        for year in range(self.start_year_to_predict, self.end_year_to_predict + 1):
            for month in range(1, NUMBER_OF_MONTHS_IN_YEAR + 1):
                number_of_months_from_peak = abs(month - peak_month)
                prediction = max(0, regressor.predict([[year, number_of_months_from_peak]])[0])
                prediction_vector.append(prediction)
        return prediction_vector

def write_prediction_rows(rows, file_name):
  if len(rows) == 0:
    return
  keys = rows[0].keys()
  with open(file_name, 'w') as output_file:
      dict_writer = csv.DictWriter(output_file, keys)
      dict_writer.writeheader()
      dict_writer.writerows(rows)

def predict(
    input_file_name,
    output_file_name,
    start_year_in_dataset,
    end_year_in_dataset,
    start_year_to_predict,
    end_year_to_predict):
    predictor = Predictor(
        start_year_in_dataset,
        end_year_in_dataset,
        start_year_to_predict,
        end_year_to_predict
        )
    with open(input_file_name) as csv_file:
        csv_reader = csv.DictReader(csv_file)
        for row in csv_reader:
            predictor.add_data_point(row)
        write_prediction_rows(predictor.predict(), output_file_name)
