import openpyxl
import os

filepath = '../dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = 'dummy data.xlsx'

wb = openpyxl.load_workbook(filepath, data_only=False)
sheet = wb['Supplier Monthly Stats']
print("Row count:", sheet.max_row)

for r_idx in range(1, min(25, sheet.max_row + 1)):
    row = [sheet.cell(r_idx, c_idx).value for c_idx in range(1, 7)]
    print(f"Row {r_idx}: {row}")
