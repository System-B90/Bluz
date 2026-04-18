from dataclasses import dataclass
from random import randint, shuffle

import httpx
import tqdm
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
        client.delete_exercise(exercise)

    for module in tqdm.tqdm(client.get_modules(), desc="Deleting Modules"):
        client.delete_module(module)

    for class_ in tqdm.tqdm(client.get_classes(), desc="Deleting Classes"):
        client.delete_class(class_)

    for subject in tqdm.tqdm(client.get_subjects(), desc="Deleting Subjects"):
        client.delete_subject(subject)

    for program in tqdm.tqdm(client.get_programs(), desc="Deleting Programs"):
        try:
            client.delete_program(program)
        except httpx.ReadTimeout as ex:
            tqdm.tqdm.write(f"Timeout deleting program {program.name}: {ex}")

    for user in tqdm.tqdm(client.get_users(), desc="Deleting Users"):
        if user.username != "admin" and user.clearance != ClearanceEnum.ADMIN:
            try:
                client.delete_user(user)
            except httpx.HTTPStatusError as ex:
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
    checker1 = client.create_user(
        "checker1",
        "Password1",
        gender=GenderEnum.MALE,
        first_name="צ׳ק",
        last_name="רמן",
        clearance=ClearanceEnum.CHECKER,
    )

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
    with HiveClient.from_sso("https://hive.org/", verify=False, timeout=10) as client:
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


if __name__ == "__main__":
    main()
