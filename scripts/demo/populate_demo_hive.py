import os
import sys
import json
from dataclasses import dataclass
from pathlib import Path
from random import randint, shuffle

# Force UTF-8 stdout/stderr to avoid charmap encoding errors on Windows
if sys.platform.startswith("win"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import httpx
import tqdm
from dotenv import load_dotenv
from pyhive import HiveClient
from pyhive.src.types.enums.class_type_enum import ClassTypeEnum
from pyhive.types import ClearanceEnum, GenderEnum


@dataclass
class UserData:
    first_name: str
    last_name: str
    gender: GenderEnum
    username: str


MOCK_STUDENTS: list[UserData] = [
    UserData(
        first_name="אליס",
        last_name="רוזן",
        gender=GenderEnum.FEMALE,
        username="test-alisr",
    ),
    UserData(
        first_name="בן", last_name="כץ", gender=GenderEnum.MALE, username="test-benk"
    ),
    UserData(
        first_name="קלרה",
        last_name="וייס",
        gender=GenderEnum.FEMALE,
        username="test-claw",
    ),
    UserData(
        first_name="דניאל",
        last_name="לוי",
        gender=GenderEnum.MALE,
        username="test-danl",
    ),
    UserData(
        first_name="אלה",
        last_name="כהן",
        gender=GenderEnum.FEMALE,
        username="test-ellc",
    ),
    UserData(
        first_name="פליקס",
        last_name="גולדמן",
        gender=GenderEnum.MALE,
        username="test-felg",
    ),
    UserData(
        first_name="גילה",
        last_name="שפירא",
        gender=GenderEnum.FEMALE,
        username="test-gilsh",
    ),
    UserData(
        first_name="הראל",
        last_name="בר-און",
        gender=GenderEnum.MALE,
        username="test-harba",
    ),
    UserData(
        first_name="ענבר",
        last_name="מזרחי",
        gender=GenderEnum.FEMALE,
        username="test-inmiz",
    ),
    UserData(
        first_name="יונה",
        last_name="פרץ",
        gender=GenderEnum.MALE,
        username="test-jonp",
    ),
]

MOCK_SEGEL: list[UserData] = [
    UserData(
        first_name="מיכאל",
        last_name="שטיינברג",
        gender=GenderEnum.MALE,
        username="test-michaelks",
    ),
    UserData(
        first_name="יובל",
        last_name="ברוורמן",
        gender=GenderEnum.FEMALE,
        username="test-yuvalb",
    ),
    UserData(
        first_name="מאיה",
        last_name="גבע",
        gender=GenderEnum.FEMALE,
        username="test-mayag",
    ),
    UserData(
        first_name="נועה",
        last_name="גולן",
        gender=GenderEnum.FEMALE,
        username="test-noag",
    ),
    UserData(
        first_name="דוד",
        last_name="אברהמי",
        gender=GenderEnum.MALE,
        username="test-davida",
    ),
    UserData(
        first_name="רוני",
        last_name="סגל",
        gender=GenderEnum.FEMALE,
        username="test-ronis",
    ),
    UserData(
        first_name="איתי",
        last_name="רגב",
        gender=GenderEnum.MALE,
        username="test-itair",
    ),
    UserData(
        first_name="דנה",
        last_name="פרידמן",
        gender=GenderEnum.FEMALE,
        username="test-danaf",
    ),
]


@dataclass
class ProgramData:
    name: str


MOCK_PROGRAMS: list[ProgramData] = [
    ProgramData(name="מגמה מגניבה"),
    ProgramData(name="מגמה סאחית"),
]


@dataclass
class ModuleData:
    name: str


@dataclass
class SubjectData:
    name: str
    symbol: str
    modules: list[ModuleData] | None = None


MOCK_SUBJECTS: list[SubjectData] = [
    SubjectData(name="סעמק", symbol="ס"),
    SubjectData(
        name="עד מתי",
        symbol="ע",
        modules=[
            ModuleData(name="התחפשנות חוד"),
            ModuleData(name="שנץ"),
        ],
    ),
    SubjectData(
        name="עבודות רסר",
        symbol="ר",
        modules=[
            ModuleData(name="טאטוא עלים"),
            ModuleData(name="ניקוי שירותים"),
            ModuleData(name="שטיפת רצפות"),
        ],
    ),
    SubjectData(name="פרויקטים", symbol="פ"),
]


@dataclass
class ClassData:
    name: str


MOCK_CLASSES: list[ClassData] = [
    ClassData(name="תל אביב"),
    ClassData(name="רמת גן"),
    ClassData(name="גבעתיים"),
    ClassData(name="פתח תקווה"),
    ClassData(name="ים המלח"),
]


def clean_existing_data(client: HiveClient):
    for exercise in tqdm.tqdm(client.get_exercises(), desc="Deleting Exercises"):
        try:
            client.delete_exercise(exercise)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting exercise: {ex}")

    for module in tqdm.tqdm(client.get_modules(), desc="Deleting Modules"):
        try:
            client.delete_module(module)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting module: {ex}")

    for class_ in tqdm.tqdm(client.get_classes(), desc="Deleting Classes"):
        try:
            client.delete_class(class_)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting class: {ex}")

    for subject in tqdm.tqdm(client.get_subjects(), desc="Deleting Subjects"):
        try:
            client.delete_subject(subject)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting subject: {ex}")

    for program in tqdm.tqdm(client.get_programs(), desc="Deleting Programs"):
        try:
            client.delete_program(program)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting program: {ex}")

    for user in tqdm.tqdm(client.get_users(), desc="Deleting Users"):
        if user.username != "admin" and user.clearance != ClearanceEnum.ADMIN:
            try:
                client.delete_user(user)
            except Exception as ex:
                tqdm.tqdm.write(f"Error deleting user {user.username}: {ex}")


def create_students(client: HiveClient):
    classes = list(client.get_classes())
    programs = list(client.get_programs())
    mentors = list(client.get_users(clearance__in=[ClearanceEnum.SEGEL]))

    for number, student_data in tqdm.tqdm(
        enumerate(MOCK_STUDENTS, start=4),
        total=len(MOCK_STUDENTS),
        desc="Creating Students",
        unit="student",
    ):
        shuffle(classes)
        shuffle(programs)

        class_count = randint(0, len(classes))
        try:
            client.create_student(
                f"test-hanich-{number}",
                "test",
                gender=student_data.gender,
                number=number,
                first_name=student_data.first_name,
                last_name=student_data.last_name,
                classes=classes[0:class_count],
                program=programs[randint(0, len(programs) - 1)],
                mentor=mentors[randint(0, len(mentors) - 1)],
            )
        except Exception as ex:
            print(ex)


def create_segel(client: HiveClient):
    for segel_data in tqdm.tqdm(MOCK_SEGEL, desc="Creating Segel", unit="segel"):
        try:
            client.create_user(
                segel_data.username,
                "test",
                gender=segel_data.gender,
                first_name=segel_data.first_name,
                last_name=segel_data.last_name,
                clearance=ClearanceEnum.SEGEL,
            )
        except Exception as ex:
            print(ex)


def create_programs(client: HiveClient):
    checker1 = None
    try:
        checkers = list(client.get_users(clearance__in=[ClearanceEnum.CHECKER]))
        checker1 = next((u for u in checkers if u.username == "checker1"), None)
        if checker1:
            print("User 'checker1' already exists, reusing.")
    except Exception as ex:
        print(f"Error checking existing checker1: {ex}")

    if not checker1:
        try:
            checker1 = client.create_user(
                "checker1",
                "Password1",
                gender=GenderEnum.MALE,
                first_name="צ׳ק",
                last_name="רמן",
                clearance=ClearanceEnum.CHECKER,
            )
        except Exception as ex:
            print(f"Error creating checker1: {ex}")
            try:
                checkers = list(client.get_users(clearance__in=[ClearanceEnum.CHECKER]))
                checker1 = next((u for u in checkers if u.username == "checker1"), None)
            except Exception:
                pass
            if not checker1:
                raise ex

    for program in tqdm.tqdm(MOCK_PROGRAMS, desc="Creating Programs", unit="program"):
        try:
            client.create_program(name=program.name, checker=checker1)
        except Exception as ex:
            print(ex)


def create_subjects(client: HiveClient):
    programs = list(client.get_programs())
    for subject in tqdm.tqdm(MOCK_SUBJECTS, desc="Creating Subjects", unit="subject"):
        try:
            s = client.create_subject(
                name=subject.name,
                symbol=subject.symbol,
                color="#1F1229",
                program=programs[randint(0, len(programs) - 1)],
            )
            if not subject.modules:
                continue
            for index, module in tqdm.tqdm(
                enumerate(subject.modules, start=1),
                desc="  Creating Modules for {}".format(subject.name),
                total=len(subject.modules),
                unit="module",
            ):
                try:
                    client.create_module(
                        name=module.name, order=index, parent_subject=s
                    )
                except Exception as ex:
                    print(ex)
        except Exception as ex:
            print(ex)


def create_classes(client: HiveClient):
    programs = list(client.get_programs())
    students = list(client.get_students())

    for class_ in tqdm.tqdm(MOCK_CLASSES, desc="Creating Classes", unit="class"):
        shuffle(students)
        try:
            client.create_class(
                program=programs[randint(0, len(programs) - 1)],
                name=class_.name,
                type_=ClassTypeEnum.ROOM,
                users=students[: randint(0, len(students))],
            )
        except Exception as ex:
            print(ex)


def main():
    # Load env file from the root directory (parent of parent of scripts/demo/)
    root_dir = Path(__file__).resolve().parents[2]
    load_dotenv(dotenv_path=root_dir / ".env")
    hive_url = os.getenv("NEXT_PUBLIC_HIVE_URL", "https://hive.org/")

    with HiveClient.from_sso(hive_url, verify=False, timeout=10) as client:
        clean_existing_data(client)

        try:
            client.create_user(
                "api",
                "Password1",
                clearance=ClearanceEnum.SEGEL,
                gender=GenderEnum.MALE,
                first_name="Api",
                last_name="Account",
            )
        except Exception:
            pass

        create_segel(client)

        create_programs(client)
        create_subjects(client)

        create_students(client)

        create_classes(client)

        # Collect generated info and write to JSON
        print("Collecting generated objects from Hive...")
        segel_users = list(client.get_users(clearance__in=[ClearanceEnum.SEGEL]))
        subjects = list(client.get_subjects())
        modules = list(client.get_modules())
        rooms = list(client.get_classes(type_=ClassTypeEnum.ROOM))

        export_data = {
            "segel": [
                {
                    "id": u.id,
                    "username": u.username,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                }
                for u in segel_users
            ],
            "subjects": [
                {
                    "id": s.id,
                    "name": s.name,
                    "symbol": s.symbol,
                    "color": s.color,
                }
                for s in subjects
            ],
            "modules": [
                {
                    "id": m.id,
                    "name": m.name,
                    "parent_subject_id": m.parent_subject_id,
                }
                for m in modules
            ],
            "rooms": [
                {
                    "id": r.id,
                    "name": r.name,
                }
                for r in rooms
            ],
        }

        json_path = Path(__file__).resolve().parent / "hive_data.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        print(f"Successfully exported Hive structural metadata to {json_path}")


if __name__ == "__main__":
    main()
