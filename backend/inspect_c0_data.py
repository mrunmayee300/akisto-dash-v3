import openpyxl
import os

filepath = '../dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = 'dummy data.xlsx'

# Let's read sheets and dump C0 data
wb = openpyxl.load_workbook(filepath, data_only=True)

print("=== Client Info ===")
sheet = wb['Client info']
for r in sheet.iter_rows(values_only=True):
    if r[0] == 'client_code' or r[0] == 'C0':
        print(r[:15])

print("\n=== PO Consolidated Data for C0 (first 10 rows) ===")
sheet = wb['PO consolidated data']
headers = next(sheet.iter_rows(values_only=True))
print("Headers:", headers[:15])
count = 0
for r in sheet.iter_rows(values_only=True):
    if r[1] == 'C0':
        count += 1
        if count <= 10:
            print(f"Row {count}:", r[:15])
print("Total PO Consolidated rows for C0:", count)

print("\n=== Communication Logs for C0 (first 10 rows) ===")
sheet = wb['Communication Logs']
headers = next(sheet.iter_rows(values_only=True))
print("Headers:", headers[:15])
count = 0
for r in sheet.iter_rows(values_only=True):
    if r[1] == 'C0':
        count += 1
        if count <= 10:
            print(f"Row {count}:", r[:15])
print("Total Communication Logs rows for C0:", count)

print("\n=== Supplier Stats for C0 ===")
sheet = wb['Supplier Stats']
for r in sheet.iter_rows(values_only=True):
    if r[0] == 'client_code' or r[0] == 'C0':
        print(r[:19])

print("\n=== Supplier Monthly Stats for C0 ===")
sheet = wb['Supplier Monthly Stats']
for r in sheet.iter_rows(values_only=True):
    if r[0] == 'client_code' or r[0] == 'C0':
        print(r)

print("\n=== Delay Event Logs for C0 ===")
sheet = wb['Delay Event Logs']
for r in sheet.iter_rows(values_only=True):
    if r[2] == 'client_code' or r[2] == 'C0':
        print(r)
