import openpyxl
import os

filepath = '../dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = 'dummy data.xlsx'

print(f"Loading {filepath}...")
wb = openpyxl.load_workbook(filepath, read_only=True)
print("Workbook loaded successfully.")

for sheet_name in wb.sheetnames:
    sheet = wb[sheet_name]
    # To get row counts quickly without reading everything, we can do this
    row_count = 0
    c0_count = 0
    non_c0_clients = {}
    
    # We can check a few rows for client code
    idx = 0
    headers = []
    for row in sheet.iter_rows(values_only=True):
        row_count += 1
        if idx == 0:
            headers = [str(x) for x in row if x is not None]
        else:
            # check client code if there is client_code column
            # search for 'client_code' in headers
            if 'client_code' in headers:
                c_idx = headers.index('client_code')
                if c_idx < len(row):
                    val = row[c_idx]
                    if val == 'C0':
                        c0_count += 1
                    elif val:
                        non_c0_clients[val] = non_c0_clients.get(val, 0) + 1
            elif 'Client Code' in headers:
                c_idx = headers.index('Client Code')
                if c_idx < len(row):
                    val = row[c_idx]
                    if val == 'C0':
                        c0_count += 1
                    elif val:
                        non_c0_clients[val] = non_c0_clients.get(val, 0) + 1
        idx += 1
        
    print(f"Sheet: {sheet_name} | Total Rows: {row_count} | C0 Rows: {c0_count} | Other Clients: {non_c0_clients}")
    if headers:
        print(f"  Headers ({len(headers)} cols): {headers[:15]}...")
