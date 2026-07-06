import marimo

__generated_with = "0.23.13"
app = marimo.App(
    width="medium",
    app_title="Evaluating Rent Burden Against Income in Major US Metropolitan Areas: A Macroscopic Analysis",
)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    Analyzes 2024 U.S. ACS data for large metropolitan areas to compare population, income, housing costs, and rent burden, with the central question of whether higher-income cities face worse rent affordability than lower-income ones. The project identifies national patterns and outlier metros to assess how median income relates to rent burden across U.S. metro areas.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Setup
    """)
    return


@app.cell
def _():
    import duckdb
    import os
    import marimo as mo

    _password = os.environ.get("MOTHERDUCK")
    conn = duckdb.connect(
        "md:us_gov_db", config={"motherduck_token": _password}
    )
    return conn, mo


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Introduction
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    This paper looks to analyze the 2024 American Community Survey (ACS) data published by the United States Census Bureau. In it, we evaluate statistics of population, income, and cost of living at both a macroscopic level.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    Q1: Do higher income cities have worse rent affordability than their lower income counterparts?
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Exploration
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    This paper relies on the American Community Survey (ACS) database, published by the United States Census Bureau. It is a comprehensive annual survey containing thousands of datasets for every year ranging from 2000-2024. (ACS, 2026) The datasets pertaining to this study have been pre-fetched and stored in the www.ryanwaked.com/data data warehouse, where details including provenance, governance, schemas, and more can be found.

    The dataset, hereby refered to as "us_gov_db", contains the following information:
    """)
    return


@app.cell(hide_code=True)
def _():
    import pandas as pd

    acs_variable_schema = pd.DataFrame(
        [
            ("Population", "B01003_001E", "Total population"),
            (
                "Income: central tendency",
                "B19013_001E",
                "Median household income",
            ),
            (
                "Income: central tendency",
                "B19113_001E",
                "Median family income",
            ),
            ("Income: central tendency", "B19301_001E", "Per capita income"),
            (
                "Income: central tendency",
                "B19025_001E",
                "Aggregate household income",
            ),
            ("Income distribution", "B19001_001E", "Household income: total"),
            (
                "Income distribution",
                "B19001_002E",
                "Household income: <$10,000",
            ),
            (
                "Income distribution",
                "B19001_003E",
                "Household income: $10,000-$14,999",
            ),
            (
                "Income distribution",
                "B19001_004E",
                "Household income: $15,000-$19,999",
            ),
            (
                "Income distribution",
                "B19001_005E",
                "Household income: $20,000-$24,999",
            ),
            (
                "Income distribution",
                "B19001_006E",
                "Household income: $25,000-$29,999",
            ),
            (
                "Income distribution",
                "B19001_007E",
                "Household income: $30,000-$34,999",
            ),
            (
                "Income distribution",
                "B19001_008E",
                "Household income: $35,000-$39,999",
            ),
            (
                "Income distribution",
                "B19001_009E",
                "Household income: $40,000-$44,999",
            ),
            (
                "Income distribution",
                "B19001_010E",
                "Household income: $45,000-$49,999",
            ),
            (
                "Income distribution",
                "B19001_011E",
                "Household income: $50,000-$59,999",
            ),
            (
                "Income distribution",
                "B19001_012E",
                "Household income: $60,000-$74,999",
            ),
            (
                "Income distribution",
                "B19001_013E",
                "Household income: $75,000-$99,999",
            ),
            (
                "Income distribution",
                "B19001_014E",
                "Household income: $100,000-$124,999",
            ),
            (
                "Income distribution",
                "B19001_015E",
                "Household income: $125,000-$149,999",
            ),
            (
                "Income distribution",
                "B19001_016E",
                "Household income: $150,000-$199,999",
            ),
            (
                "Income distribution",
                "B19001_017E",
                "Household income: $200,000+",
            ),
            (
                "Housing cost levels",
                "B25077_001E",
                "Median home value (owner-occupied)",
            ),
            ("Housing cost levels", "B25064_001E", "Median gross rent"),
            (
                "Rent burden: summary",
                "B25071_001E",
                "Median gross rent as pct of household income",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_001E",
                "GRAPI: total renters",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_002E",
                "GRAPI: <10.0%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_003E",
                "GRAPI: 10.0-14.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_004E",
                "GRAPI: 15.0-19.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_005E",
                "GRAPI: 20.0-24.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_006E",
                "GRAPI: 25.0-29.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_007E",
                "GRAPI: 30.0-34.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_008E",
                "GRAPI: 35.0-39.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_009E",
                "GRAPI: 40.0-49.9%",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_010E",
                "GRAPI: 50.0%+",
            ),
            (
                "Rent burden: full GRAPI distribution (renters)",
                "B25070_011E",
                "GRAPI: not computed",
            ),
            ("Rent burden by income", "B25074_001E", "Income x GRAPI: total"),
            (
                "Rent burden by income",
                "B25074_002E",
                "Income <$10,000: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_003E",
                "Income <$10,000: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_004E",
                "Income <$10,000: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_005E",
                "Income <$10,000: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_006E",
                "Income <$10,000: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_007E",
                "Income <$10,000: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_008E",
                "Income <$10,000: GRAPI not computed",
            ),
            (
                "Rent burden by income",
                "B25074_009E",
                "Income $10,000-$19,999: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_010E",
                "Income $10,000-$19,999: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_011E",
                "Income $10,000-$19,999: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_012E",
                "Income $10,000-$19,999: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_013E",
                "Income $10,000-$19,999: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_014E",
                "Income $10,000-$19,999: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_015E",
                "Income $10,000-$19,999: GRAPI not computed",
            ),
            (
                "Rent burden by income",
                "B25074_016E",
                "Income $20,000-$34,999: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_017E",
                "Income $20,000-$34,999: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_018E",
                "Income $20,000-$34,999: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_019E",
                "Income $20,000-$34,999: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_020E",
                "Income $20,000-$34,999: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_021E",
                "Income $20,000-$34,999: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_022E",
                "Income $20,000-$34,999: GRAPI not computed",
            ),
            (
                "Rent burden by income",
                "B25074_023E",
                "Income $35,000-$49,999: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_024E",
                "Income $35,000-$49,999: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_025E",
                "Income $35,000-$49,999: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_026E",
                "Income $35,000-$49,999: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_027E",
                "Income $35,000-$49,999: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_028E",
                "Income $35,000-$49,999: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_029E",
                "Income $35,000-$49,999: GRAPI not computed",
            ),
            (
                "Rent burden by income",
                "B25074_030E",
                "Income $50,000-$74,999: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_031E",
                "Income $50,000-$74,999: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_032E",
                "Income $50,000-$74,999: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_033E",
                "Income $50,000-$74,999: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_034E",
                "Income $50,000-$74,999: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_035E",
                "Income $50,000-$74,999: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_036E",
                "Income $50,000-$74,999: GRAPI not computed",
            ),
            (
                "Rent burden by income",
                "B25074_037E",
                "Income $75,000+: subtotal",
            ),
            (
                "Rent burden by income",
                "B25074_038E",
                "Income $75,000+: GRAPI <20%",
            ),
            (
                "Rent burden by income",
                "B25074_039E",
                "Income $75,000+: GRAPI 20.0-24.9%",
            ),
            (
                "Rent burden by income",
                "B25074_040E",
                "Income $75,000+: GRAPI 25.0-29.9%",
            ),
            (
                "Rent burden by income",
                "B25074_041E",
                "Income $75,000+: GRAPI 30.0-34.9%",
            ),
            (
                "Rent burden by income",
                "B25074_042E",
                "Income $75,000+: GRAPI 35.0%+",
            ),
            (
                "Rent burden by income",
                "B25074_043E",
                "Income $75,000+: GRAPI not computed",
            ),
            ("Owner cost burden", "B25092_001E", "Median SMOCAPI: all owners"),
            (
                "Owner cost burden",
                "B25092_002E",
                "Median SMOCAPI: with mortgage",
            ),
            (
                "Owner cost burden",
                "B25092_003E",
                "Median SMOCAPI: without mortgage",
            ),
            ("Owner cost burden", "B25091_001E", "SMOCAPI: total owners"),
            (
                "Owner cost burden",
                "B25091_002E",
                "SMOCAPI with mortgage: subtotal",
            ),
            ("Owner cost burden", "B25091_003E", "SMOCAPI w/mortgage: <10.0%"),
            (
                "Owner cost burden",
                "B25091_004E",
                "SMOCAPI w/mortgage: 10.0-14.9%",
            ),
            (
                "Owner cost burden",
                "B25091_005E",
                "SMOCAPI w/mortgage: 15.0-19.9%",
            ),
            (
                "Owner cost burden",
                "B25091_006E",
                "SMOCAPI w/mortgage: 20.0-24.9%",
            ),
            (
                "Owner cost burden",
                "B25091_007E",
                "SMOCAPI w/mortgage: 25.0-29.9%",
            ),
            (
                "Owner cost burden",
                "B25091_008E",
                "SMOCAPI w/mortgage: 30.0-34.9%",
            ),
            (
                "Owner cost burden",
                "B25091_009E",
                "SMOCAPI w/mortgage: 35.0-39.9%",
            ),
            (
                "Owner cost burden",
                "B25091_010E",
                "SMOCAPI w/mortgage: 40.0-49.9%",
            ),
            ("Owner cost burden", "B25091_011E", "SMOCAPI w/mortgage: 50.0%+"),
            (
                "Owner cost burden",
                "B25091_012E",
                "SMOCAPI w/mortgage: not computed",
            ),
            (
                "Owner cost burden",
                "B25091_013E",
                "SMOCAPI without mortgage: subtotal",
            ),
            (
                "Owner cost burden",
                "B25091_014E",
                "SMOCAPI w/o mortgage: <10.0%",
            ),
            (
                "Owner cost burden",
                "B25091_015E",
                "SMOCAPI w/o mortgage: 10.0-14.9%",
            ),
            (
                "Owner cost burden",
                "B25091_016E",
                "SMOCAPI w/o mortgage: 15.0-19.9%",
            ),
            (
                "Owner cost burden",
                "B25091_017E",
                "SMOCAPI w/o mortgage: 20.0-24.9%",
            ),
            (
                "Owner cost burden",
                "B25091_018E",
                "SMOCAPI w/o mortgage: 25.0-29.9%",
            ),
            (
                "Owner cost burden",
                "B25091_019E",
                "SMOCAPI w/o mortgage: 30.0-34.9%",
            ),
            (
                "Owner cost burden",
                "B25091_020E",
                "SMOCAPI w/o mortgage: 35.0-39.9%",
            ),
            (
                "Owner cost burden",
                "B25091_021E",
                "SMOCAPI w/o mortgage: 40.0-49.9%",
            ),
            (
                "Owner cost burden",
                "B25091_022E",
                "SMOCAPI w/o mortgage: 50.0%+",
            ),
            (
                "Owner cost burden",
                "B25091_023E",
                "SMOCAPI w/o mortgage: not computed",
            ),
            ("Tenure & occupancy", "B25002_001E", "Housing units: total"),
            ("Tenure & occupancy", "B25002_002E", "Occupied units"),
            ("Tenure & occupancy", "B25002_003E", "Vacant units"),
            ("Tenure & occupancy", "B25003_001E", "Occupied housing units"),
            ("Tenure & occupancy", "B25003_002E", "Owner-occupied units"),
            ("Tenure & occupancy", "B25003_003E", "Renter-occupied units"),
            ("Poverty", "B17001_001E", "Poverty universe (status determined)"),
            ("Poverty", "B17001_002E", "Population below poverty (count)"),
            ("Employment", "B23025_002E", "In labor force"),
            ("Employment", "B23025_003E", "Civilian labor force"),
            ("Employment", "B23025_005E", "Unemployed (count)"),
            (
                "Education (25+)",
                "B15003_001E",
                "Population 25+ (education universe)",
            ),
            ("Education (25+)", "B15003_022E", "Bachelor's degree (count)"),
            ("Education (25+)", "B15003_023E", "Master's degree (count)"),
            ("Education (25+)", "B15003_024E", "Professional degree (count)"),
            ("Education (25+)", "B15003_025E", "Doctorate degree (count)"),
            (
                "Commute",
                "B08013_001E",
                "Aggregate travel time to work (minutes)",
            ),
            ("Commute", "B08303_001E", "Workers who commute (count)"),
        ],
        columns=["category", "acs_variable", "description"],
    )

    acs_variable_schema.insert(
        0,
        "acs_table",
        acs_variable_schema["acs_variable"].str.split("_").str[0],
    )
    acs_variable_schema
    return


@app.cell
def _(conn, mo):
    acs_df = mo.sql(
        f"""
        SELECT *
        FROM us_gov_db.raw.census_acs5_2024
        """,
        engine=conn
    )
    return (acs_df,)


@app.cell(hide_code=True)
def _(acs_df, mo):
    labeled_acs_df = mo.sql(
        f"""
        SELECT
            NAME AS metropolitan_or_micropolitan_statistical_area_name,
            B01003_001E AS total_population,
            B19013_001E AS median_household_income,
            B19113_001E AS median_family_income,
            B19301_001E AS per_capita_income,
            B19025_001E AS aggregate_household_income,
            B19001_001E AS household_income_total,
            B19001_002E AS household_income_under_10_000,
            B19001_003E AS household_income_10_000_14_999,
            B19001_004E AS household_income_15_000_19_999,
            B19001_005E AS household_income_20_000_24_999,
            B19001_006E AS household_income_25_000_29_999,
            B19001_007E AS household_income_30_000_34_999,
            B19001_008E AS household_income_35_000_39_999,
            B19001_009E AS household_income_40_000_44_999,
            B19001_010E AS household_income_45_000_49_999,
            B19001_011E AS household_income_50_000_59_999,
            B19001_012E AS household_income_60_000_74_999,
            B19001_013E AS household_income_75_000_99_999,
            B19001_014E AS household_income_100_000_124_999,
            B19001_015E AS household_income_125_000_149_999,
            B19001_016E AS household_income_150_000_199_999,
            B19001_017E AS household_income_200_000_plus,
            B25077_001E AS median_home_value_owner_occupied,
            B25064_001E AS median_gross_rent,
            B25071_001E AS median_gross_rent_as_pct_of_household_income,
            B25070_001E AS grapi_total_renters,
            B25070_002E AS grapi_under_10_0_pct,
            B25070_003E AS grapi_10_0_14_9_pct,
            B25070_004E AS grapi_15_0_19_9_pct,
            B25070_005E AS grapi_20_0_24_9_pct,
            B25070_006E AS grapi_25_0_29_9_pct,
            B25070_007E AS grapi_30_0_34_9_pct,
            B25070_008E AS grapi_35_0_39_9_pct,
            B25070_009E AS grapi_40_0_49_9_pct,
            B25070_010E AS grapi_50_0_pct_plus,
            B25070_011E AS grapi_not_computed,
            B25074_001E AS income_x_grapi_total,
            B25074_002E AS income_under_10_000_subtotal,
            B25074_003E AS income_under_10_000_grapi_under_20_pct,
            B25074_004E AS income_under_10_000_grapi_20_0_24_9_pct,
            B25074_005E AS income_under_10_000_grapi_25_0_29_9_pct,
            B25074_006E AS income_under_10_000_grapi_30_0_34_9_pct,
            B25074_007E AS income_under_10_000_grapi_35_0_pct_plus,
            B25074_008E AS income_under_10_000_grapi_not_computed,
            B25074_009E AS income_10_000_19_999_subtotal,
            B25074_010E AS income_10_000_19_999_grapi_under_20_pct,
            B25074_011E AS income_10_000_19_999_grapi_20_0_24_9_pct,
            B25074_012E AS income_10_000_19_999_grapi_25_0_29_9_pct,
            GEO_ID_x AS geo_id_rent_burden_table,
            "metropolitan statistical area/micropolitan statistical area" AS cbsa_geographic_code_for_the_area,
            B25074_013E AS income_10_000_19_999_grapi_30_0_34_9_pct,
            B25074_014E AS income_10_000_19_999_grapi_35_0_pct_plus,
            B25074_015E AS income_10_000_19_999_grapi_not_computed,
            B25074_016E AS income_20_000_34_999_subtotal,
            B25074_017E AS income_20_000_34_999_grapi_under_20_pct,
            B25074_018E AS income_20_000_34_999_grapi_20_0_24_9_pct,
            B25074_019E AS income_20_000_34_999_grapi_25_0_29_9_pct,
            B25074_020E AS income_20_000_34_999_grapi_30_0_34_9_pct,
            B25074_021E AS income_20_000_34_999_grapi_35_0_pct_plus,
            B25074_022E AS income_20_000_34_999_grapi_not_computed,
            B25074_023E AS income_35_000_49_999_subtotal,
            B25074_024E AS income_35_000_49_999_grapi_under_20_pct,
            B25074_025E AS income_35_000_49_999_grapi_20_0_24_9_pct,
            B25074_026E AS income_35_000_49_999_grapi_25_0_29_9_pct,
            B25074_027E AS income_35_000_49_999_grapi_30_0_34_9_pct,
            B25074_028E AS income_35_000_49_999_grapi_35_0_pct_plus,
            B25074_029E AS income_35_000_49_999_grapi_not_computed,
            B25074_030E AS income_50_000_74_999_subtotal,
            B25074_031E AS income_50_000_74_999_grapi_under_20_pct,
            B25074_032E AS income_50_000_74_999_grapi_20_0_24_9_pct,
            B25074_033E AS income_50_000_74_999_grapi_25_0_29_9_pct,
            B25074_034E AS income_50_000_74_999_grapi_30_0_34_9_pct,
            B25074_035E AS income_50_000_74_999_grapi_35_0_pct_plus,
            B25074_036E AS income_50_000_74_999_grapi_not_computed,
            B25074_037E AS income_75_000_plus_subtotal,
            B25074_038E AS income_75_000_plus_grapi_under_20_pct,
            B25074_039E AS income_75_000_plus_grapi_20_0_24_9_pct,
            B25074_040E AS income_75_000_plus_grapi_25_0_29_9_pct,
            B25074_041E AS income_75_000_plus_grapi_30_0_34_9_pct,
            B25074_042E AS income_75_000_plus_grapi_35_0_pct_plus,
            B25074_043E AS income_75_000_plus_grapi_not_computed,
            B25092_001E AS median_smocapi_all_owners,
            B25092_002E AS median_smocapi_with_mortgage,
            B25092_003E AS median_smocapi_without_mortgage,
            B25091_001E AS smocapi_total_owners,
            B25091_002E AS smocapi_with_mortgage_subtotal,
            B25091_003E AS smocapi_with_mortgage_under_10_0_pct,
            B25091_004E AS smocapi_with_mortgage_10_0_14_9_pct,
            B25091_005E AS smocapi_with_mortgage_15_0_19_9_pct,
            B25091_006E AS smocapi_with_mortgage_20_0_24_9_pct,
            B25091_007E AS smocapi_with_mortgage_25_0_29_9_pct,
            B25091_008E AS smocapi_with_mortgage_30_0_34_9_pct,
            B25091_009E AS smocapi_with_mortgage_35_0_39_9_pct,
            B25091_010E AS smocapi_with_mortgage_40_0_49_9_pct,
            B25091_011E AS smocapi_with_mortgage_50_0_pct_plus,
            B25091_012E AS smocapi_with_mortgage_not_computed,
            B25091_013E AS smocapi_without_mortgage_subtotal,
            B25091_014E AS smocapi_without_mortgage_under_10_0_pct,
            B25091_015E AS smocapi_without_mortgage_10_0_14_9_pct,
            GEO_ID_y AS geo_id_owner_cost_burden_table,
            B25091_016E AS smocapi_without_mortgage_15_0_19_9_pct,
            B25091_017E AS smocapi_without_mortgage_20_0_24_9_pct,
            B25091_018E AS smocapi_without_mortgage_25_0_29_9_pct,
            B25091_019E AS smocapi_without_mortgage_30_0_34_9_pct,
            B25091_020E AS smocapi_without_mortgage_35_0_39_9_pct,
            B25091_021E AS smocapi_without_mortgage_40_0_49_9_pct,
            B25091_022E AS smocapi_without_mortgage_50_0_pct_plus,
            B25091_023E AS smocapi_without_mortgage_not_computed,
            B25002_001E AS housing_units_total,
            B25002_002E AS occupied_units,
            B25002_003E AS vacant_units,
            B25003_001E AS occupied_housing_units,
            B25003_002E AS owner_occupied_units,
            B25003_003E AS renter_occupied_units,
            B17001_001E AS poverty_universe_status_determined,
            B17001_002E AS population_below_poverty_count,
            B23025_002E AS in_labor_force,
            B23025_003E AS civilian_labor_force,
            B23025_005E AS unemployed_count,
            B15003_001E AS population_25_plus_education_universe,
            B15003_022E AS bachelors_degree_count,
            B15003_023E AS masters_degree_count,
            B15003_024E AS professional_degree_count,
            B15003_025E AS doctorate_degree_count,
            B08013_001E AS aggregate_travel_time_to_work_minutes,
            B08303_001E AS workers_who_commute_count,
            _loaded_at AS loaded_at
        FROM acs_df
        """
    )
    return (labeled_acs_df,)


@app.cell
def _(labeled_acs_df, mo):
    rent_against_income_df = mo.sql(
        f"""
        SELECT *
        FROM labeled_acs_df
        WHERE total_population > 200000
          AND metropolitan_or_micropolitan_statistical_area_name NOT ILIKE '%, PR%'
        """
    )
    return


if __name__ == "__main__":
    app.run()
