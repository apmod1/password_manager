from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from .models import CustomUser
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.support.wait import WebDriverWait
from django.urls import reverse
import hashlib


class RegisterViewTests(StaticLiveServerTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.username = b"foo"
        cls.password = "awesomesauce"
        cls.user_hash = hashlib.sha512(cls.username)

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.setUpTestData()
        cls.selenium = WebDriver()
        cls.selenium.implicitly_wait(10)

    @classmethod
    def tearDownClass(cls):
        cls.selenium.quit()
        super().tearDownClass()

    def testRegister(self):
        url = reverse("password_manager:register")
        self.selenium.get("%s%s" % (self.live_server_url, url))
        username_input = self.selenium.find_element(By.NAME, "sha512hash")
        username_input.send_keys(self.username.decode("utf-8"))
        password1_input = self.selenium.find_element(By.NAME, "password1")
        password1_input.send_keys(self.password)
        password2_input = self.selenium.find_element(By.NAME, "password2")
        password2_input.send_keys(self.password)
        self.selenium.find_element(By.XPATH, "//button[@type='submit']").click()
        timeout = 2
        WebDriverWait(self.selenium, timeout).until(
            lambda driver: driver.find_element(By.TAG_NAME, "body")
        )
        user = CustomUser.objects.get(sha512hash=self.user_hash.digest())
        self.failUnless(user.check_password(self.password))


# class CustomUserModel(TestCase):
#     def SetUp(self):
