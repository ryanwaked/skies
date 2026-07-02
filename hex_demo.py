import marimo

__generated_with = "0.23.13"
app = marimo.App(
    width="medium",
    app_title="Evaluating Rent Burden Against Income in Major US Metropolitan Areas",
)


@app.cell(hide_code=True)
def introduction(mo):
    mo.md(r"""
    # Introduction

    This paper looks to analyze the 2024 American Community Survey (ACS) data published by the United
    States Census Bureau. In it, we evaluate statistics of population, income, and cost of living at both a
    macroscopic level (metropolitan), as well as microscopic levels (by class, race, etc. within metropolitan
    regions).
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Exploring the data
    """)
    return


@app.cell(hide_code=True)
def explanation(mo):
    mo.md(r"""
    This paper relies on the American Community Survey (ACS) database, published by the United States
    Census Bureau. It is a comprehensive annual survey containing thousands of datasets for every year
    ranging from 2000-2024. (ACS, 2026) The datasets pertaining to this study have been pre-fetched and
    stored in the [www.ryanwaked.com/data](https://www.ryanwaked.com/data) data warehouse, where details
    including provenance, governance, schemas, and more can be found.

    The dataset, hereby refered to as `us_gov_db`, contains the following information:
    """)
    return


@app.cell
def load_data(pd):
    metros = pd.DataFrame(
        {
            "metro": [
                "New York-Newark-Jersey City",
                "Los Angeles-Long Beach-Anaheim",
                "Chicago-Naperville-Elgin",
                "Dallas-Fort Worth-Arlington",
                "Houston-The Woodlands-Sugar Land",
                "Phoenix-Mesa-Chandler",
                "Portland-Vancouver-Hillsboro",
                "Seattle-Tacoma-Bellevue",
            ],
            "median_income": [93610, 89105, 86795, 83886, 78061, 82525, 94573, 110744],
            "median_rent": [1875, 2075, 1420, 1495, 1345, 1620, 1690, 1985],
            "population_m": [19.5, 12.9, 9.4, 8.1, 7.5, 5.1, 2.5, 4.0],
        }
    )
    metros["rent_burden_pct"] = (metros["median_rent"] * 12 / metros["median_income"] * 100).round(1)
    metros
    return (metros,)


@app.cell
def rent_burden_query(mo, metros):
    _df = mo.sql(
        f"""
        SELECT metro, median_income, median_rent, rent_burden_pct
        FROM metros
        ORDER BY rent_burden_pct DESC
        """
    )
    return


@app.cell
def rent_burden_chart(alt, metros):
    chart = (
        alt.Chart(metros)
        .mark_bar()
        .encode(
            x=alt.X("rent_burden_pct:Q", title="Rent burden (% of income)"),
            y=alt.Y("metro:N", sort="-x", title=None),
            tooltip=["metro", "median_income", "median_rent", "rent_burden_pct"],
        )
        .properties(height=280)
    )
    chart
    return


@app.cell
def imports():
    import marimo as mo
    import pandas as pd
    import altair as alt

    return alt, mo, pd


if __name__ == "__main__":
    app.run()
