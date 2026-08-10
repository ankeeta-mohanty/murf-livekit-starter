from memory import lookup_caller, save_caller


def test_save_and_lookup_caller_memory(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "memory.sqlite3"
    monkeypatch.setenv("SAHAYA_MEMORY_DB", str(database_path))

    saved = save_caller(
        user_id="caller-123",
        name="Ramesh",
        language_preference="Hinglish",
        facts={
            "location": "Cuttack",
            "household_size": "4",
            "mobility_needs": "elderly parent",
            "last_check_in": "asked about flood shelter",
        },
    )

    assert saved["user_id"] == "caller-123"
    assert saved["name"] == "Ramesh"
    assert saved["facts"]["location"] == "Cuttack"

    record = lookup_caller("caller-123")

    assert record is not None
    assert record["language_preference"] == "Hinglish"
    assert record["facts"]["household_size"] == "4"


def test_save_merges_existing_facts(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "memory.sqlite3"
    monkeypatch.setenv("SAHAYA_MEMORY_DB", str(database_path))

    save_caller(
        user_id="caller-123",
        name="Ramesh",
        facts={"location": "Cuttack"},
    )
    save_caller(
        user_id="caller-123",
        name="Ramesh Kumar",
        facts={"last_check_in": "safe at school shelter"},
    )

    record = lookup_caller("caller-123")

    assert record is not None
    assert record["name"] == "Ramesh Kumar"
    assert record["facts"] == {
        "location": "Cuttack",
        "last_check_in": "safe at school shelter",
    }
