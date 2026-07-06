import openpyxl
import os

filepath = '../dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = 'dummy data.xlsx'

wb = openpyxl.load_workbook(filepath, read_only=True)
sheet = wb['Communication Logs']

for row in sheet.iter_rows(max_row=1, values_only=True):
    headers = row
    break

print("Total columns:", len(headers))
for idx in range(min(208, len(headers)), min(220, len(headers))):
    print(f"Col {idx+1} ({openpyxl.utils.get_column_letter(idx+1)}): {headers[idx]}")
