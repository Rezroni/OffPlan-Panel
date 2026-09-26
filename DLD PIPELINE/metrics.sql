CREATE OR REPLACE VIEW market_transaction_daily AS
SELECT
    instance_date,
    area_name_en,
    count(*) AS transaction_count,
    sum(actual_worth) AS transaction_value_aed,
    median(actual_worth / procedure_area) AS median_aed_per_sqm
FROM raw_transactions_valid
GROUP BY instance_date, area_name_en;

CREATE OR REPLACE VIEW market_rent_daily AS
SELECT
    contract_start_date,
    area_name_en,
    count(*) AS contract_count,
    median(annual_amount) AS median_annual_rent_aed,
    sum(annual_amount) AS annual_rent_value_aed
FROM raw_rent_contracts_valid
GROUP BY contract_start_date, area_name_en;

CREATE OR REPLACE VIEW project_service_charges AS
SELECT
    project_id,
    budget_year,
    sum(service_cost) AS service_cost_aed,
    count(*) AS charge_line_count
FROM raw_service_charges_valid
GROUP BY project_id, budget_year;
